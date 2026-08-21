import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchDictionary, indexLocalDictionary } from './searchService'
import { db } from '../db/dictionaryDb'
import { supabase } from '../api/supabaseClient'

// Mock dependencies
vi.mock('../db/dictionaryDb', () => {
  const firstMock = vi.fn()
  const mockDb = {
    dictSyncMeta: {
      toCollection: () => ({
        first: firstMock,
      }),
      add: vi.fn(),
    },
    dictionary: {
      get: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      offset: vi.fn(),
    },
  }
  return { db: mockDb }
})

vi.mock('../api/supabaseClient', () => {
  return {
    supabase: {
      functions: {
        invoke: vi.fn(),
      },
    },
  }
})

describe('searchRouter (State A/B/C routing)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('navigator', { onLine: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('State A (online): should invoke edge function when online and no local data', async () => {
    // Mock local DB having no version
    vi.mocked(db.dictSyncMeta.toCollection().first).mockResolvedValue({
      localVersion: 0,
      downloadState: 'idle',
      downloadProgress: 0,
      lastCheckedAt: 0,
    })

    // Mock edge function response
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { data: [{ id: 1, lemma: 'üben', pos: 'verb' }] },
      error: null,
    })

    const results = await searchDictionary('uben')
    expect(results).toHaveLength(1)
    expect(results[0].lemma).toBe('üben')
    expect(supabase.functions.invoke).toHaveBeenCalledWith('dictionary-search', {
      body: { query: 'uben' },
    })
  })

  it('State A (offline): should throw an error when offline and no local data', async () => {
    // Set offline
    vi.stubGlobal('navigator', { onLine: false })

    vi.mocked(db.dictSyncMeta.toCollection().first).mockResolvedValue({
      localVersion: 0,
      downloadState: 'idle',
      downloadProgress: 0,
      lastCheckedAt: 0,
    })

    await expect(searchDictionary('uben')).rejects.toThrow(
      'Koneksi internet diperlukan untuk pencarian pertama kali karena database kamus offline belum diunduh.'
    )
  })

  it('State B (offline, local data indexed): should route to local MiniSearch index, not the network', async () => {
    vi.stubGlobal('navigator', { onLine: false })

    // Local dictionary has entries to index
    const entries = [
      { id: 1, lemma: 'üben', pos: 'verb', gender: null, plural: null, translations: 'to practice', level: 'A1', frequency_rank: 5 },
    ]
    vi.mocked(db.dictionary.count).mockResolvedValue(1)
    vi.mocked(db.dictionary.offset).mockReturnValue({
      limit: () => ({ toArray: vi.fn().mockResolvedValue(entries) }),
    } as any)

    await indexLocalDictionary(true)

    vi.mocked(db.dictSyncMeta.toCollection().first).mockResolvedValue({
      localVersion: 1,
      downloadState: 'idle',
      downloadProgress: 100,
      lastCheckedAt: 0,
    })

    const results = await searchDictionary('uben')

    expect(results).toHaveLength(1)
    expect(results[0].lemma).toBe('üben')
    // Must not hit the network path
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('State A (offline, never downloaded): should throw informative error instead of hanging/routing to local index', async () => {
    vi.stubGlobal('navigator', { onLine: false })

    // No local data indexed at all
    vi.mocked(db.dictionary.count).mockResolvedValue(0)
    vi.mocked(db.dictSyncMeta.toCollection().first).mockResolvedValue({
      localVersion: 0,
      downloadState: 'idle',
      downloadProgress: 0,
      lastCheckedAt: 0,
    })

    await expect(searchDictionary('uben')).rejects.toThrow(
      'Koneksi internet diperlukan untuk pencarian pertama kali karena database kamus offline belum diunduh.'
    )
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('concurrent indexLocalDictionary(true) calls only run one indexing pass (no interleaved removeAll/addAll corruption)', async () => {
    const entries = [
      { id: 1, lemma: 'Apfel', pos: 'noun', gender: 'm', plural: 'Äpfel', translations: 'apple', level: 'A1', frequency_rank: 100 },
    ]
    vi.mocked(db.dictionary.count).mockResolvedValue(1)
    const offsetCalls: number[] = []
    vi.mocked(db.dictionary.offset).mockImplementation((n: number) => {
      offsetCalls.push(n)
      return { limit: () => ({ toArray: vi.fn().mockResolvedValue(entries) }) } as any
    })

    // Fire two concurrent forced rebuilds, as would happen if a search-triggered
    // rebuild and the syncManager subscription's rebuild race each other.
    await Promise.all([indexLocalDictionary(true), indexLocalDictionary(true)])

    // Only one pass should have actually read from Dexie -- a second concurrent
    // force=true call must await the in-flight pass instead of starting its own.
    expect(offsetCalls).toEqual([0])
  })

  it('local search ranks an exact/prefix match above a fuzzy-only match regardless of frequency_rank', async () => {
    vi.stubGlobal('navigator', { onLine: false })

    const entries = [
      // Apferl (fuzzy match for "apfel", 1 edit away) deliberately given a
      // BETTER frequency_rank than Apfel to prove prefix-tier wins outright,
      // not just as a tie-breaker.
      { id: 2, lemma: 'Apferl', pos: 'noun', gender: null, plural: null, translations: 'diminutive of Apfel', level: null, frequency_rank: 10 },
      { id: 1, lemma: 'Apfel', pos: 'noun', gender: 'm', plural: 'Äpfel', translations: 'apple', level: 'A1', frequency_rank: 5228 },
    ]
    vi.mocked(db.dictionary.count).mockResolvedValue(entries.length)
    vi.mocked(db.dictionary.offset).mockReturnValue({
      limit: () => ({ toArray: vi.fn().mockResolvedValue(entries) }),
    } as any)

    await indexLocalDictionary(true)

    vi.mocked(db.dictSyncMeta.toCollection().first).mockResolvedValue({
      localVersion: 1,
      downloadState: 'idle',
      downloadProgress: 100,
      lastCheckedAt: 0,
    })

    const results = await searchDictionary('apfel')

    expect(results[0].lemma).toBe('Apfel')
  })

  it('does not fuzzy-match translations (e.g. "black" must not surface unrelated words via "back")', async () => {
    vi.stubGlobal('navigator', { onLine: false })

    const entries = [
      { id: 1, lemma: 'schwarz', pos: 'adj', gender: null, plural: null, translations: 'black, reflecting little or no light', level: 'A1', frequency_rank: 200 },
      // "back" is 1 edit away from "black" -- fuzzy on lemma is fine (German
      // typo tolerance), but must NOT apply when matching via `translations`,
      // otherwise every entry whose translation merely contains "back" (a very
      // common English word) floods the results for a "black" query.
      { id: 2, lemma: 'zurück', pos: 'adv', gender: null, plural: null, translations: 'back, backward, backwards', level: 'A1', frequency_rank: 50 },
    ]
    vi.mocked(db.dictionary.count).mockResolvedValue(entries.length)
    vi.mocked(db.dictionary.offset).mockReturnValue({
      limit: () => ({ toArray: vi.fn().mockResolvedValue(entries) }),
    } as any)

    await indexLocalDictionary(true)

    vi.mocked(db.dictSyncMeta.toCollection().first).mockResolvedValue({
      localVersion: 1,
      downloadState: 'idle',
      downloadProgress: 100,
      lastCheckedAt: 0,
    })

    const results = await searchDictionary('black')

    expect(results.map((r) => r.lemma)).toContain('schwarz')
    expect(results.map((r) => r.lemma)).not.toContain('zurück')
  })

  it('ranks a full multi-word phrase match above entries that only match one of the words', async () => {
    vi.stubGlobal('navigator', { onLine: false })

    // "Zimmer" (room) and "Leben" (living) are common, high-frequency words
    // that each match only one word of "living room" -- without phrase-aware
    // tiering, dozens of such single-word coincidences with better
    // frequency_rank than "Wohnzimmer" push the actual phrase match past the
    // top-20 cutoff (reproduced with the real dictionary export: Wohnzimmer
    // landed at position 22).
    const entries = [
      { id: 1, lemma: 'Wohnzimmer', pos: 'noun', gender: 'n', plural: null, translations: 'living room', level: 'A2', frequency_rank: 3990 },
      { id: 2, lemma: 'Zimmer', pos: 'noun', gender: null, plural: null, translations: 'room', level: 'A1', frequency_rank: 513 },
      { id: 3, lemma: 'Leben', pos: 'noun', gender: null, plural: null, translations: 'living, life', level: 'A1', frequency_rank: 135 },
    ]
    vi.mocked(db.dictionary.count).mockResolvedValue(entries.length)
    vi.mocked(db.dictionary.offset).mockReturnValue({
      limit: () => ({ toArray: vi.fn().mockResolvedValue(entries) }),
    } as any)

    await indexLocalDictionary(true)

    vi.mocked(db.dictSyncMeta.toCollection().first).mockResolvedValue({
      localVersion: 1,
      downloadState: 'idle',
      downloadProgress: 100,
      lastCheckedAt: 0,
    })

    const results = await searchDictionary('living room')

    expect(results[0].lemma).toBe('Wohnzimmer')
  })
})
