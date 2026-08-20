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
})
