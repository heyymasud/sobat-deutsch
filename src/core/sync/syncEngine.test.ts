import { describe, it, expect, vi, beforeEach } from 'vitest'

// syncEngine's module-level singleton touches window/navigator (online listener) on
// construction; stub both so this test can run under vitest's default node environment
// without pulling in jsdom.
;(globalThis as any).window ??= { addEventListener: vi.fn(), removeEventListener: vi.fn() }
;(globalThis as any).navigator ??= { onLine: true }
import { db } from '../db/dictionaryDb'
import { supabase } from '../api/supabaseClient'

vi.mock('../db/dictionaryDb', () => {
  const mockDb = {
    decks: { get: vi.fn(), update: vi.fn() },
    srsCards: { get: vi.fn() },
    syncQueue: {
      orderBy: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      hook: vi.fn(),
    },
  }
  return { db: mockDb }
})

vi.mock('../api/supabaseClient', () => {
  return {
    supabase: {
      auth: { getSession: vi.fn() },
      from: vi.fn(),
      rpc: vi.fn(),
    },
  }
})

const SESSION = { data: { session: { user: { id: 'user-1' } } } }

describe('syncEngine.triggerSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    ;(globalThis as any).navigator.onLine = true
    ;(supabase.auth.getSession as any).mockResolvedValue(SESSION)
    ;(db.syncQueue.count as any).mockResolvedValue(0)
  })

  it('pushes a decks insert item and removes it from the queue only after success', async () => {
    const { syncEngine } = await import('./syncEngine')

    const queueItem = {
      id: 1,
      action: 'insert' as const,
      entityTable: 'decks' as const,
      entityData: { id: 42, name: 'Verben' },
      queuedAt: 1,
    }
    ;(db.syncQueue.orderBy as any).mockReturnValue({ toArray: vi.fn().mockResolvedValue([queueItem]) })

    const single = vi.fn().mockResolvedValue({ data: { id: 'server-deck-uuid' }, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    ;(supabase.from as any).mockReturnValue({ insert })

    await syncEngine.triggerSync()

    expect(insert).toHaveBeenCalledWith({ name: 'Verben', user_id: 'user-1' })
    expect(db.decks.update).toHaveBeenCalledWith(42, { serverId: 'server-deck-uuid' })
    expect(db.syncQueue.delete).toHaveBeenCalledWith(1)
  })

  it('does NOT remove a decks insert item from the queue when the push fails', async () => {
    const { syncEngine } = await import('./syncEngine')

    const queueItem = {
      id: 2,
      action: 'insert' as const,
      entityTable: 'decks' as const,
      entityData: { id: 43, name: 'Substantive' },
      queuedAt: 1,
    }
    ;(db.syncQueue.orderBy as any).mockReturnValue({ toArray: vi.fn().mockResolvedValue([queueItem]) })

    const single = vi.fn().mockResolvedValue({ data: null, error: new Error('network down') })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    ;(supabase.from as any).mockReturnValue({ insert })

    await syncEngine.triggerSync()

    expect(db.decks.update).not.toHaveBeenCalled()
    expect(db.syncQueue.delete).not.toHaveBeenCalled()
  })

  it('pushes a reviewLogs insert item and removes it from the queue only after success', async () => {
    const { syncEngine } = await import('./syncEngine')

    const queueItem = {
      id: 3,
      action: 'insert' as const,
      entityTable: 'reviewLogs' as const,
      entityData: { cardId: 7, rating: 3, interval: 4, reviewedAt: 123456 },
      queuedAt: 1,
    }
    ;(db.syncQueue.orderBy as any).mockReturnValue({ toArray: vi.fn().mockResolvedValue([queueItem]) })
    ;(db.srsCards.get as any).mockResolvedValue({ id: 7, deckId: 1, wordRef: 'gehen', cardType: 'konjugasi', interval: 2 })
    ;(db.decks.get as any).mockResolvedValue({ id: 1, serverId: 'server-deck-uuid' })

    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'server-card-uuid' }, error: null })
    const findChain: any = { eq: vi.fn(() => findChain), maybeSingle }
    const selectForFind = vi.fn(() => findChain)
    const insertReviewLog = vi.fn().mockResolvedValue({ error: null })

    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === 'srs_cards') return { select: selectForFind }
      if (table === 'review_logs') return { insert: insertReviewLog }
      throw new Error(`unexpected table ${table}`)
    })

    await syncEngine.triggerSync()

    expect(insertReviewLog).toHaveBeenCalledWith(
      expect.objectContaining({ card_id: 'server-card-uuid', user_id: 'user-1', rating: 'sedang' })
    )
    expect(db.syncQueue.delete).toHaveBeenCalledWith(3)
  })

  it('does NOT remove a reviewLogs insert item when the server card cannot be resolved yet', async () => {
    const { syncEngine } = await import('./syncEngine')

    const queueItem = {
      id: 4,
      action: 'insert' as const,
      entityTable: 'reviewLogs' as const,
      entityData: { cardId: 8, rating: 1, interval: 1, reviewedAt: 123456 },
      queuedAt: 1,
    }
    ;(db.syncQueue.orderBy as any).mockReturnValue({ toArray: vi.fn().mockResolvedValue([queueItem]) })
    ;(db.srsCards.get as any).mockResolvedValue({ id: 8, deckId: 1, wordRef: 'laufen', cardType: 'konjugasi', interval: 0 })
    ;(db.decks.get as any).mockResolvedValue({ id: 1, serverId: 'server-deck-uuid' })

    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null }) // card not synced yet
    const findChain: any = { eq: vi.fn(() => findChain), maybeSingle }
    ;(supabase.from as any).mockReturnValue({ select: vi.fn(() => findChain) })

    await syncEngine.triggerSync()

    expect(db.syncQueue.delete).not.toHaveBeenCalled()
  })

  // S9-01 (AC-SYNC-02, BR-SYNC-02): srsCards updates must go through the
  // conditional "only if newer" RPC, not a plain upsert — a plain upsert
  // always overwrites on conflict (arrival-order wins, not last-write-wins).
  it('pushes a srsCards update via the conditional upsert RPC with the local updatedAt', async () => {
    const { syncEngine } = await import('./syncEngine')

    const queueItem = {
      id: 5,
      action: 'update' as const,
      entityTable: 'srsCards' as const,
      entityData: { id: 9, interval: 6, easeFactor: 2.5, repetitions: 2, dueDate: 1700000000000, updatedAt: 1690000000000 },
      queuedAt: 1,
    }
    ;(db.syncQueue.orderBy as any).mockReturnValue({ toArray: vi.fn().mockResolvedValue([queueItem]) })
    ;(db.srsCards.get as any).mockResolvedValue({ id: 9, deckId: 1, wordRef: 'gehen', cardType: 'konjugasi' })
    ;(db.decks.get as any).mockResolvedValue({ id: 1, serverId: 'server-deck-uuid' })
    ;(supabase.rpc as any).mockResolvedValue({ error: null })

    await syncEngine.triggerSync()

    expect(supabase.rpc).toHaveBeenCalledWith('upsert_srs_card_if_newer', expect.objectContaining({
      p_deck_id: 'server-deck-uuid',
      p_word_ref: 'gehen',
      p_card_type: 'konjugasi',
      p_interval: 6,
      p_ease_factor: 2.5,
      p_repetitions: 2,
      p_updated_at: new Date(1690000000000).toISOString(),
    }))
    expect(db.syncQueue.delete).toHaveBeenCalledWith(5)
  })

  // The server-side "only if newer" guarantee itself lives in the RPC (WHERE
  // excluded.updated_at > srs_cards.updated_at) and is verified live against
  // local Supabase — see docs/SPRINT_CHECKLIST.md S9-01 bukti. This test only
  // proves the client stays queued (doesn't lose the pending push) if the RPC
  // rejects a stale write by returning no error but also not applying it —
  // i.e. the client never treats "stale, so skipped" as a failure to retry.
  it('does NOT remove a srsCards update item from the queue when the RPC errors', async () => {
    const { syncEngine } = await import('./syncEngine')

    const queueItem = {
      id: 6,
      action: 'update' as const,
      entityTable: 'srsCards' as const,
      entityData: { id: 10, interval: 1, easeFactor: 2.5, repetitions: 1, dueDate: 1700000000000, updatedAt: 1600000000000 },
      queuedAt: 1,
    }
    ;(db.syncQueue.orderBy as any).mockReturnValue({ toArray: vi.fn().mockResolvedValue([queueItem]) })
    ;(db.srsCards.get as any).mockResolvedValue({ id: 10, deckId: 1, wordRef: 'laufen', cardType: 'gender' })
    ;(db.decks.get as any).mockResolvedValue({ id: 1, serverId: 'server-deck-uuid' })
    ;(supabase.rpc as any).mockResolvedValue({ error: new Error('network down') })

    await syncEngine.triggerSync()

    expect(db.syncQueue.delete).not.toHaveBeenCalled()
  })

  // S9-02 (AC-SYNC-01, AC-SYNC-03, FR-SYNC-06): syncEngine must expose its own
  // queue status (separate from syncManager's dictionary-download status) so
  // the UI can show "Tersinkron" / "X menunggu" / an error + retry affordance.
  it('exposes pendingCount via subscribe, tracked through syncQueue creating/deleting hooks', async () => {
    ;(db.syncQueue.count as any).mockResolvedValue(0)
    const { syncEngine } = await import('./syncEngine')

    // Let the constructor's initial db.syncQueue.count() resolve.
    await Promise.resolve()
    await Promise.resolve()

    const statuses: any[] = []
    const unsubscribe = syncEngine.subscribe((s) => statuses.push(s))
    expect(statuses[0]).toEqual({ state: 'synced', pendingCount: 0, error: null })

    const creatingCb = (db.syncQueue.hook as any).mock.calls.find((c: any[]) => c[0] === 'creating')[1]
    const deletingCb = (db.syncQueue.hook as any).mock.calls.find((c: any[]) => c[0] === 'deleting')[1]

    creatingCb()
    expect(statuses.at(-1)).toMatchObject({ pendingCount: 1, state: 'idle' })

    deletingCb()
    expect(statuses.at(-1)).toMatchObject({ pendingCount: 0, state: 'synced' })

    unsubscribe()
  })

  it('sets state to error with the pending item retained when a srsCards push fails, and back to synced after a successful retry', async () => {
    ;(db.syncQueue.count as any).mockResolvedValue(0)
    const { syncEngine } = await import('./syncEngine')
    await Promise.resolve()
    await Promise.resolve()

    const statuses: any[] = []
    syncEngine.subscribe((s) => statuses.push(s))

    const queueItem = {
      id: 7,
      action: 'update' as const,
      entityTable: 'srsCards' as const,
      entityData: { id: 11, interval: 1, easeFactor: 2.5, repetitions: 1, dueDate: 1700000000000, updatedAt: 1600000000000 },
      queuedAt: 1,
    }
    ;(db.syncQueue.orderBy as any).mockReturnValue({ toArray: vi.fn().mockResolvedValue([queueItem]) })
    ;(db.srsCards.get as any).mockResolvedValue({ id: 11, deckId: 1, wordRef: 'kommen', cardType: 'gender' })
    ;(db.decks.get as any).mockResolvedValue({ id: 1, serverId: 'server-deck-uuid' })
    ;(supabase.rpc as any).mockResolvedValueOnce({ error: new Error('offline') })

    await syncEngine.triggerSync()
    expect(statuses.at(-1)).toMatchObject({ state: 'error' })
    expect(statuses.at(-1).error).toBeTruthy()

    // Retry succeeds this time.
    ;(supabase.rpc as any).mockResolvedValueOnce({ error: null })
    await syncEngine.triggerSync()
    expect(statuses.at(-1)).toMatchObject({ state: 'synced', error: null })
  })
})
