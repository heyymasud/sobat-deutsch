import MiniSearch from 'minisearch'
import { db } from '../db/dictionaryDb'
import { supabase } from '../api/supabaseClient'
import { syncManager } from '../dictSync/syncManager'
import type { DictionaryEntry } from '../../modules/dictionary/types'

// Custom normalizer for umlauts and ss/ß
const normalizeTerm = (term: string): string => {
  return term
    .toLowerCase()
    .normalize('NFD') // decomposes characters like u + umlaut
    .replace(/[\u0300-\u036f]/g, '') // removes accents/umlauts
    .replace(/ß/g, 'ss')
}

// Configure MiniSearch
const miniSearch = new MiniSearch<DictionaryEntry>({
  fields: ['lemma', 'translations'],
  storeFields: ['id', 'lemma', 'pos', 'gender', 'plural', 'translations', 'level', 'frequency_rank'],
  processTerm: (term) => {
    // Split on spaces/hyphens and normalize
    return normalizeTerm(term)
  },
  searchOptions: {
    prefix: true,
    fuzzy: (term) => (term.length > 3 ? 0.2 : 0), // only apply fuzzy for terms > 3 chars
    combineWith: 'OR',
  },
})

let isIndexed = false
let indexingPromise: Promise<void> | null = null

export const indexLocalDictionary = async (force: boolean = false): Promise<void> => {
  if (isIndexed && !force) return
  // Always dedupe against an in-flight run, even when force=true. Without this,
  // a forced call (e.g. from the syncManager subscription below) racing against
  // an already-running index build would start a SECOND concurrent pass; since
  // both passes call miniSearch.removeAll() then re-populate in awaited chunks,
  // their removeAll()/addAll() calls interleave and can wipe out entries the
  // other pass already added, or duplicate entries — producing a corrupted
  // final index (some words missing, others appearing twice) even though each
  // pass individually would have rebuilt correctly. A fresh, already-in-flight
  // rebuild already satisfies "force" — just await it instead of starting another.
  if (indexingPromise) return indexingPromise

  indexingPromise = (async () => {
    try {
      console.log('Loading dictionary entries from Dexie for indexing...')
      const count = await db.dictionary.count()
      if (count === 0) {
        console.log('IndexedDB dictionary table is empty. Local search disabled.')
        isIndexed = false
        return
      }

      miniSearch.removeAll()

      const batchSize = 10000
      let offset = 0
      
      while (offset < count) {
        const chunk = await db.dictionary.offset(offset).limit(batchSize).toArray()
        if (chunk.length === 0) break
        
        // Populate MiniSearch
        miniSearch.addAll(chunk)
        offset += chunk.length
        console.log(`  Indexed ${offset}/${count} entries...`)
      }

      isIndexed = true
      console.log('MiniSearch local indexing completed successfully.')
    } catch (err) {
      console.error('Failed to index local dictionary:', err)
      isIndexed = false
      throw err
    } finally {
      indexingPromise = null
    }
  })()

  return indexingPromise
}

// Re-index on syncManager success
syncManager.subscribe((status) => {
  if (status.downloadState === 'idle' && status.localVersion > 0 && !isIndexed) {
    indexLocalDictionary(true)
  }
})

export interface SearchResult {
  id: number
  lemma: string
  pos: string | null
  gender: 'm' | 'f' | 'n' | null
  plural: string | null
  translations: string | null
  level: 'A1' | 'A2' | 'B1' | null
  frequency_rank: number | null
}

export const searchDictionary = async (query: string): Promise<SearchResult[]> => {
  const trimmed = query.trim()
  if (!trimmed) return []

  const meta = await db.dictSyncMeta.toCollection().first()
  // If local data has been downloaded but indexing hasn't finished/started yet
  // (e.g. a sync just completed), wait for it instead of racing into the
  // online path — otherwise routing flaps between State A/B depending on
  // exactly when the user searches relative to background indexing.
  if (meta && meta.localVersion > 0 && !isIndexed) {
    await indexLocalDictionary()
  }
  const hasLocalData = meta && meta.localVersion > 0 && isIndexed

  if (hasLocalData) {
    // State B/C: Local search
    console.log('Performing local search using MiniSearch...')
    const normalized = normalizeTerm(trimmed)

    // Fuzzy typo-tolerance makes sense for German lemma spelling (e.g. "uben" ~
    // "üben"), but applying it to `translations` too caused nonsense matches --
    // e.g. querying "black" fuzzy-matched the unrelated English word "back"
    // (edit distance 1), flooding results with irrelevant entries and burying
    // the actually-correct "schwarz". So: lemma keeps fuzzy+prefix; translations
    // only gets exact prefix/substring matching, no fuzzy.
    const lemmaHits = miniSearch.search(normalized, { fields: ['lemma'] })
    const translationHits = miniSearch.search(normalized, { fields: ['translations'], fuzzy: 0, prefix: true })

    const byId = new Map<number, DictionaryEntry & { _tier: number }>()
    for (const r of lemmaHits) {
      const entry = r as unknown as DictionaryEntry
      const tier = entry.lemma.toLowerCase().startsWith(normalized) ? 0 : 2 // exact/prefix lemma vs fuzzy-only lemma
      byId.set(entry.id, { ...entry, _tier: tier })
    }
    for (const r of translationHits) {
      const entry = r as unknown as DictionaryEntry
      const existing = byId.get(entry.id)
      if (!existing || existing._tier > 1) byId.set(entry.id, { ...entry, _tier: 1 }) // translations match, unless already a better lemma-prefix hit
    }

    // Tier 0 (lemma prefix) > tier 1 (translation match) > tier 2 (fuzzy-only
    // lemma, e.g. "Apferl" for "Apfel") -- then within each tier, by frequency.
    return Array.from(byId.values())
      .map((r) => r as unknown as SearchResult)
      .sort((a, b) => {
        const tierA = (a as any)._tier
        const tierB = (b as any)._tier
        if (tierA !== tierB) return tierA - tierB
        const rankA = a.frequency_rank ?? 999999
        const rankB = b.frequency_rank ?? 999999
        return rankA - rankB
      })
      .slice(0, 20)
  } else {
    // State A: Online search via Edge Function
    console.log('Performing online search via Edge Function...')
    if (!navigator.onLine) {
      throw new Error('Koneksi internet diperlukan untuk pencarian pertama kali karena database kamus offline belum diunduh.')
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('dictionary-search', {
        body: { query: trimmed },
      })

      if (error) {
        throw error
      }

      return (data?.data || []) as SearchResult[]
    } catch (err: any) {
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('fetch'))) {
        throw new Error('Koneksi internet diperlukan untuk pencarian pertama kali karena database kamus offline belum diunduh.')
      }
      throw err
    }
  }
}
