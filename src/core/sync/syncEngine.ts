import { db } from '../db/dictionaryDb'
import { supabase } from '../api/supabaseClient'

// Local numeric rating (1-4, see ReviewSession keyboard shortcuts) -> server text rating (BR-SYNC-03 schema check).
const RATING_LABELS = ['lupa', 'sulit', 'sedang', 'mudah'] as const

// S9-02 (AC-SYNC-01, AC-SYNC-03, FR-SYNC-06): status surface for the decks/srsCards/
// reviewLogs push queue, distinct from syncManager's dictionary-download status.
export interface SyncEngineStatus {
  state: 'idle' | 'syncing' | 'synced' | 'error'
  pendingCount: number
  error: string | null
}

export type SyncEngineListener = (status: SyncEngineStatus) => void

class DictionarySyncEngine {
  private isSyncing = false
  private onlineStatus = navigator.onLine
  private listeners = new Set<SyncEngineListener>()
  // ponytail: tracked incrementally via Dexie hooks below instead of re-querying
  // db.syncQueue.count() on every change — cheap and avoids a query per card rating.
  private pendingCount = 0
  private status: SyncEngineStatus = { state: 'idle', pendingCount: 0, error: null }

  constructor() {
    window.addEventListener('online', () => this.handleNetworkChange(true))
    window.addEventListener('offline', () => this.handleNetworkChange(false))

    db.syncQueue.count().then((count) => {
      this.pendingCount = count
      this.updateStatus({ pendingCount: count, state: count === 0 ? 'synced' : 'idle' })
    })
    db.syncQueue.hook('creating', () => {
      this.pendingCount++
      this.updateStatus({ pendingCount: this.pendingCount, state: this.isSyncing ? 'syncing' : 'idle' })
    })
    db.syncQueue.hook('deleting', () => {
      this.pendingCount = Math.max(0, this.pendingCount - 1)
      if (!this.isSyncing) {
        this.updateStatus({ pendingCount: this.pendingCount, state: this.pendingCount === 0 ? 'synced' : 'idle' })
      }
    })
  }

  public subscribe(listener: SyncEngineListener): () => void {
    this.listeners.add(listener)
    listener(this.status)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private updateStatus(patch: Partial<SyncEngineStatus>) {
    this.status = { ...this.status, ...patch }
    this.listeners.forEach((l) => l(this.status))
  }

  private handleNetworkChange(online: boolean) {
    this.onlineStatus = online
    console.log(`Network status changed: ${online ? 'ONLINE' : 'OFFLINE'}`)
    if (online) {
      this.triggerSync()
    }
  }

  /**
   * Migrate guest local data to the newly logged-in Supabase user.
   */
  public async migrateGuestData(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    console.log('Starting guest data migration to logged-in user...')

    try {
      const decks = await db.decks.toArray()
      const srsCards = await db.srsCards.toArray()
      const reviewLogs = await db.reviewLogs.toArray()

      if (decks.length === 0) {
        console.log('No guest data to migrate.')
        return
      }

      // Call Edge Function
      const { error } = await supabase.functions.invoke('migrate-guest-data', {
        body: { decks, srsCards, reviewLogs }
      })

      if (error) throw error

      console.log('Guest data successfully migrated to server. Clearing local guest tables.')
      
      // Clear local tables and then pull clean data from Postgres
      await db.transaction('rw', [db.decks, db.srsCards, db.reviewLogs, db.syncQueue], async () => {
        await db.decks.clear()
        await db.srsCards.clear()
        await db.reviewLogs.clear()
        await db.syncQueue.clear()
      })

      await this.pullServerData()
    } catch (err) {
      console.error('Failed to migrate guest data:', err)
    }
  }

  /**
   * Pull authenticated user data from remote Postgres to local IndexedDB.
   */
  public async pullServerData(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    console.log('Pulling database from server...')

    try {
      // 1. Pull Decks
      const { data: remoteDecks, error: decksErr } = await supabase
        .from('decks')
        .select('*')

      if (decksErr) throw decksErr

      // 2. Pull Cards
      const { data: remoteCards, error: cardsErr } = await supabase
        .from('srs_cards')
        .select('*')

      if (cardsErr) throw cardsErr

      // Write to local IndexedDB
      await db.transaction('rw', [db.decks, db.srsCards], async () => {
        await db.decks.clear()
        await db.srsCards.clear()

        const deckUuidToLocalId: Record<string, number> = {}

        for (const d of remoteDecks || []) {
          const localId = await db.decks.add({
            name: d.name,
            createdAt: new Date(d.created_at).getTime()
          })
          deckUuidToLocalId[d.id] = localId
        }

        for (const c of remoteCards || []) {
          const localDeckId = deckUuidToLocalId[c.deck_id]
          if (!localDeckId) continue

          await db.srsCards.add({
            deckId: localDeckId,
            wordRef: c.word_ref,
            cardType: c.card_type as any,
            interval: c.interval,
            easeFactor: parseFloat(c.ease_factor),
            repetitions: c.repetitions,
            dueDate: new Date(c.due_date).getTime(),
            createdAt: new Date(c.created_at).getTime(),
            updatedAt: new Date(c.updated_at).getTime()
          })
        }
      })

      console.log('Decks and cards successfully synchronized from server.')
    } catch (err) {
      console.error('Failed to pull server data:', err)
    }
  }

  /**
   * Synchronize pending syncQueue items to Supabase.
   */
  public async triggerSync(): Promise<void> {
    if (this.isSyncing || !this.onlineStatus) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return // Syncing only for authenticated users

    const queueItems = await db.syncQueue.orderBy('queuedAt').toArray()
    if (queueItems.length === 0) {
      this.updateStatus({ state: 'synced', pendingCount: 0, error: null })
      return
    }

    this.isSyncing = true
    this.updateStatus({ state: 'syncing', error: null })
    console.log(`SyncEngine: pushing ${queueItems.length} items to server...`)

    let failedCount = 0
    let lastError: string | null = null

    try {
      for (const item of queueItems) {
        const pushed = await this.pushQueueItem(item, session.user.id)
        // Only drop the item once its push actually succeeded — otherwise leave it
        // queued so the next triggerSync() retries it. Never delete-then-lose data.
        if (pushed) {
          await db.syncQueue.delete(item.id!)
        } else {
          failedCount++
          lastError = `Gagal menyinkronkan item ${item.entityTable}`
        }
      }
      console.log('SyncEngine: push complete.')
    } catch (err) {
      console.error('Sync failed:', err)
      failedCount++
      lastError = err instanceof Error ? err.message : 'Sync gagal'
    } finally {
      this.isSyncing = false
      this.updateStatus({
        state: failedCount > 0 ? 'error' : 'synced',
        pendingCount: this.pendingCount,
        error: failedCount > 0 ? lastError : null,
      })
    }
  }

  /**
   * Push a single queue item to Supabase. Returns true only if the push
   * succeeded (or the item is a no-op that's safe to drop) — the caller
   * removes the queue item only in that case, so a failed/incomplete push
   * always stays queued for retry instead of being silently lost.
   */
  private async pushQueueItem(item: import('../db/dictionaryDb').SyncQueueItem, userId: string): Promise<boolean> {
    try {
      if (item.entityTable === 'srsCards' && (item.action === 'update' || item.action === 'insert')) {
        const localCard = await db.srsCards.get(item.entityData.id)
        if (!localCard) return true // card no longer exists locally, nothing to sync

        const localDeck = await db.decks.get(localCard.deckId)
        if (!localDeck?.serverId) return false // deck hasn't synced yet — retry after it does

        // Conditional upsert via RPC (S9-01, BR-SYNC-02): a plain PostgREST upsert
        // always overwrites on conflict (arrival-order wins). The RPC only writes
        // when the incoming updated_at is newer than what's stored, so a stale
        // push arriving after a newer one never clobbers it.
        const updatedAtMs = item.entityData.updatedAt ?? Date.now()
        const { error } = await supabase.rpc('upsert_srs_card_if_newer', {
          p_deck_id: localDeck.serverId,
          p_word_ref: localCard.wordRef,
          p_card_type: localCard.cardType,
          p_interval: item.entityData.interval,
          p_ease_factor: item.entityData.easeFactor,
          p_repetitions: item.entityData.repetitions,
          p_due_date: new Date(item.entityData.dueDate).toISOString().split('T')[0],
          p_state: item.entityData.state ?? null,
          p_updated_at: new Date(updatedAtMs).toISOString()
        })

        if (error) {
          console.error('Error syncing card update:', error)
          return false
        }
        return true
      }

      if (item.entityTable === 'decks') {
        return await this.pushDeckOp(item, userId)
      }

      if (item.entityTable === 'reviewLogs' && item.action === 'insert') {
        return await this.pushReviewLogInsert(item, userId)
      }

      // Unknown/unsupported combination — leave queued rather than silently dropping it.
      console.warn('SyncEngine: no push handler for queue item, leaving queued', item)
      return false
    } catch (err) {
      console.error('SyncEngine: push threw for queue item, leaving queued', item, err)
      return false
    }
  }

  private async pushDeckOp(item: import('../db/dictionaryDb').SyncQueueItem, userId: string): Promise<boolean> {
    if (item.action === 'insert') {
      const { data, error } = await supabase
        .from('decks')
        .insert({ name: item.entityData.name, user_id: userId })
        .select('id')
        .single()

      if (error) {
        console.error('Error syncing deck insert:', error)
        return false
      }

      // Remember the server row so later rename/delete ops on this deck can target it.
      await db.decks.update(item.entityData.id, { serverId: data.id })
      return true
    }

    if (item.action === 'update') {
      const localDeck = await db.decks.get(item.entityData.id)
      if (!localDeck) return true // deck already removed locally
      if (!localDeck.serverId) return false // insert hasn't synced yet — retry after it does

      const { error } = await supabase
        .from('decks')
        .update({ name: item.entityData.name })
        .eq('id', localDeck.serverId)

      if (error) {
        console.error('Error syncing deck rename:', error)
        return false
      }
      return true
    }

    if (item.action === 'delete') {
      // The local deck row is already gone by the time this is queued, so the
      // caller (DeckManager) must have captured serverId into entityData beforehand.
      if (!item.entityData.serverId) return true // never made it to the server — nothing to delete

      const { error } = await supabase
        .from('decks')
        .delete()
        .eq('id', item.entityData.serverId)

      if (error) {
        console.error('Error syncing deck delete:', error)
        return false
      }
      return true
    }

    return true
  }

  private async pushReviewLogInsert(item: import('../db/dictionaryDb').SyncQueueItem, userId: string): Promise<boolean> {
    const localCard = await db.srsCards.get(item.entityData.cardId)
    if (!localCard) return true // card gone locally, log can never be resolved server-side

    const localDeck = await db.decks.get(localCard.deckId)
    if (!localDeck?.serverId) return false // deck hasn't synced yet — retry later

    // srs_cards rows have no local serverId tracking (yet), so resolve the
    // server row id via its natural key, same pattern as the srsCards upsert above.
    const { data: remoteCard, error: findErr } = await supabase
      .from('srs_cards')
      .select('id')
      .eq('deck_id', localDeck.serverId)
      .eq('word_ref', localCard.wordRef)
      .eq('card_type', localCard.cardType)
      .maybeSingle()

    if (findErr) {
      console.error('Error resolving server card for review log:', findErr)
      return false
    }
    if (!remoteCard) return false // card row hasn't synced yet — retry later

    const rating = item.entityData.rating as number
    const { error } = await supabase.from('review_logs').insert({
      card_id: remoteCard.id,
      user_id: userId,
      rating: RATING_LABELS[rating - 1] ?? RATING_LABELS[0],
      reviewed_at: new Date(item.entityData.reviewedAt).toISOString(),
      interval_before: localCard.interval,
      interval_after: item.entityData.interval
    })

    if (error) {
      console.error('Error syncing review log insert:', error)
      return false
    }
    return true
  }
}

export const syncEngine = new DictionarySyncEngine()
