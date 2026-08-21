import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db } from '../db/dictionaryDb'
import { supabase } from '../api/supabaseClient'

vi.mock('../db/dictionaryDb', () => {
  const firstMock = vi.fn()
  const mockDb = {
    dictSyncMeta: {
      toCollection: () => ({ first: firstMock }),
      add: vi.fn(),
      update: vi.fn(),
    },
    dictionary: {
      clear: vi.fn(),
      bulkAdd: vi.fn(),
      offset: vi.fn(),
    },
    dictionaryStaging: {
      clear: vi.fn(),
      bulkPut: vi.fn(),
      count: vi.fn(),
      offset: vi.fn(),
    },
    transaction: vi.fn(),
  }
  return { db: mockDb }
})

vi.mock('../api/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
      storage: {
        from: vi.fn(),
      },
    },
  }
})

// Minimal XMLHttpRequest mock: startDownload uses xhr.open/send + onload/onerror/onprogress
class MockXHR {
  static instances: MockXHR[] = []
  static nextResponseText = ''
  status = 200
  responseText = ''
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  onprogress: ((e: any) => void) | null = null
  open = vi.fn()
  send = vi.fn(() => {
    // fire async so caller's promise executor attaches handlers first
    this.responseText = MockXHR.nextResponseText
    setTimeout(() => this.onload && this.onload(), 0)
  })
  constructor() {
    MockXHR.instances.push(this)
  }
}

// Mirrors downloadWorker.ts's onmessage handler, but runs inline (no real
// Worker in jsdom) reusing the same MockXHR so existing test setup still
// drives it via MockXHR.nextResponseText/status.
class MockWorker {
  onmessage: ((e: { data: any }) => void) | null = null
  onerror: ((e: any) => void) | null = null
  postMessage(msg: { url: string }) {
    const xhr = new (globalThis as any).XMLHttpRequest()
    xhr.open('GET', msg.url, true)
    xhr.onprogress = (e: any) => {
      if (e.lengthComputable) {
        this.onmessage?.({ data: { type: 'progress', progress: Math.round((e.loaded / e.total) * 100) } })
      }
    }
    xhr.onload = () => {
      if (xhr.status !== 200) {
        this.onmessage?.({ data: { type: 'error', message: `Gagal mengunduh file: HTTP ${xhr.status}` } })
        return
      }
      try {
        const entries = JSON.parse(xhr.responseText)
        this.onmessage?.({ data: { type: 'done', entries } })
      } catch {
        this.onmessage?.({ data: { type: 'error', message: 'Format file unduhan tidak valid' } })
      }
    }
    xhr.onerror = () => {
      this.onmessage?.({ data: { type: 'error', message: 'Koneksi jaringan error saat mengunduh.' } })
    }
    xhr.send()
  }
  terminate() {}
}

describe('DictionarySyncManager', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
    MockXHR.instances = []
    MockXHR.nextResponseText = ''
    vi.stubGlobal('XMLHttpRequest', MockXHR as any)
    vi.stubGlobal('Worker', MockWorker as any)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const setupCommonMocks = (localVersion: number) => {
    vi.mocked(db.dictSyncMeta.toCollection().first).mockResolvedValue({
      id: 1,
      localVersion,
      downloadState: 'idle',
      downloadProgress: 0,
      lastCheckedAt: 0,
    })
  }

  it('detects a newer server version is available and starts a download', async () => {
    const { syncManager } = await import('./syncManager')
    setupCommonMocks(1)

    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({
        limit: () => ({
          single: () => Promise.resolve({ data: { version: 2, row_count: 1, checksum: 'abc' }, error: null }),
        }),
      }),
    } as any)

    vi.mocked(supabase.storage.from).mockReturnValue({
      getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/dict.json' } }),
    } as any)

    const entries = [{ id: 1, lemma: 'Haus' }]
    vi.mocked(db.dictionaryStaging.count).mockResolvedValue(entries.length)
    vi.mocked(db.dictionaryStaging.offset).mockReturnValue({
      limit: () => ({ toArray: vi.fn().mockResolvedValue(entries) }),
    } as any)
    vi.mocked(db.transaction).mockImplementation((async (_mode: any, _tables: any, cb: any) => cb()) as typeof db.transaction)

    MockXHR.nextResponseText = JSON.stringify(entries)
    await syncManager.checkForUpdates()
    // allow the setTimeout-fired onload + subsequent async work to flush
    await new Promise((r) => setTimeout(r, 10))

    expect(db.dictionaryStaging.clear).toHaveBeenCalled()
    expect(db.dictionary.clear).toHaveBeenCalled()
    expect(db.dictionary.bulkAdd).toHaveBeenCalledWith(entries)
  })

  it('two concurrent checkForUpdates() calls (e.g. React StrictMode double-invoking an effect) only run one download, not two interleaved ones', async () => {
    const { syncManager } = await import('./syncManager')
    setupCommonMocks(1)

    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({
        limit: () => ({
          single: () => Promise.resolve({ data: { version: 2, row_count: 1, checksum: 'abc' }, error: null }),
        }),
      }),
    } as any)

    vi.mocked(supabase.storage.from).mockReturnValue({
      getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/dict.json' } }),
    } as any)

    const entries = [{ id: 1, lemma: 'Haus' }]
    vi.mocked(db.dictionaryStaging.count).mockResolvedValue(entries.length)
    vi.mocked(db.dictionaryStaging.offset).mockReturnValue({
      limit: () => ({ toArray: vi.fn().mockResolvedValue(entries) }),
    } as any)
    vi.mocked(db.transaction).mockImplementation((async (_mode: any, _tables: any, cb: any) => cb()) as typeof db.transaction)

    MockXHR.nextResponseText = JSON.stringify(entries)

    // Fire twice back-to-back, synchronously, before either has a chance to
    // reach its first await -- this is exactly what StrictMode's double effect
    // invocation (or a background check racing a manual retry) produces.
    await Promise.all([syncManager.checkForUpdates(), syncManager.checkForUpdates()])
    await new Promise((r) => setTimeout(r, 10))

    // Only one download should have actually run -- one XHR issued and one
    // staging write pass (bulkPut once for the single-entry batch), not two
    // interleaved downloads corrupting the local dataset. (dictionaryStaging.clear()
    // legitimately runs twice per single successful download -- once before writing,
    // once after the atomic swap copies into `dictionary` -- so that count alone
    // wouldn't distinguish one run from two; bulkPut call count does.)
    expect(MockXHR.instances.length).toBe(1)
    expect(db.dictionaryStaging.bulkPut).toHaveBeenCalledTimes(1)
  })

  it('reports up-to-date (no download) when local version already matches server version', async () => {
    const { syncManager } = await import('./syncManager')
    setupCommonMocks(2)

    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({
        limit: () => ({
          single: () => Promise.resolve({ data: { version: 2, row_count: 1, checksum: 'abc' }, error: null }),
        }),
      }),
    } as any)

    const statuses: string[] = []
    syncManager.subscribe((s) => statuses.push(s.downloadState))

    await syncManager.checkForUpdates()

    expect(supabase.storage.from).not.toHaveBeenCalled()
    expect(statuses).toContain('idle')
  })

  it('rejects the swap when downloaded row count does not match expected row_count (checksum/row-count mismatch)', async () => {
    const { syncManager } = await import('./syncManager')
    setupCommonMocks(1)

    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({
        limit: () => ({
          // server expects 5 rows
          single: () => Promise.resolve({ data: { version: 2, row_count: 5, checksum: 'abc' }, error: null }),
        }),
      }),
    } as any)

    vi.mocked(supabase.storage.from).mockReturnValue({
      getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/dict.json' } }),
    } as any)

    // Only 1 row will be downloaded, mismatching expected row_count of 5
    const entries = [{ id: 1, lemma: 'Haus' }]
    MockXHR.nextResponseText = JSON.stringify(entries)
    await syncManager.checkForUpdates()
    await new Promise((r) => setTimeout(r, 10))

    // Staging must never be promoted into the live table
    expect(db.dictionary.clear).not.toHaveBeenCalled()
    expect(db.dictionary.bulkAdd).not.toHaveBeenCalled()
    // Staging is cleared out as part of failure cleanup, not as part of a swap
    expect(db.dictionaryStaging.bulkPut).not.toHaveBeenCalled()

    const finalStatus = syncManager['status'] as { downloadState: string; error: string | null }
    expect(finalStatus.downloadState).toBe('failed')
    expect(finalStatus.error).toMatch(/tidak lengkap/)
  })
})
