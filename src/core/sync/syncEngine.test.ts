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
    },
  }
  return { db: mockDb }
})

vi.mock('../api/supabaseClient', () => {
  return {
    supabase: {
      auth: { getSession: vi.fn() },
      from: vi.fn(),
    },
  }
})

const SESSION = { data: { session: { user: { id: 'user-1' } } } }

describe('syncEngine.triggerSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).navigator.onLine = true
    ;(supabase.auth.getSession as any).mockResolvedValue(SESSION)
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
})
