import { db } from '../db/dictionaryDb'
import { supabase } from '../api/supabaseClient'

// Local numeric rating (1-4, see ReviewSession keyboard shortcuts) -> server text rating (BR-SYNC-03 schema check).
const RATING_LABELS = ['lupa', 'sulit', 'sedang', 'mudah'] as const

class DictionarySyncEngine {
  private isSyncing = false
  private onlineStatus = navigator.onLine

  constructor() {
    window.addEventListener('online', () => this.handleNetworkChange(true))
    window.addEventListener('offline', () => this.handleNetworkChange(false))
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
            createdAt: new Date(c.created_at).getTime()
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
    if (queueItems.length === 0) return

    this.isSyncing = true
    console.log(`SyncEngine: pushing ${queueItems.length} items to server...`)

    try {
      for (const item of queueItems) {
        const pushed = await this.pushQueueItem(item, session.user.id)
        // Only drop the item once its push actually succeeded — otherwise leave it
        // queued so the next triggerSync() retries it. Never delete-then-lose data.
        if (pushed) {
          await db.syncQueue.delete(item.id!)
        }
      }
      console.log('SyncEngine: push complete.')
    } catch (err) {
      console.error('Sync failed:', err)
    } finally {
      this.isSyncing = false
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

        // Upsert card to Postgres. RLS handles user matching. We lookup by deck_id, word_ref, and card_type
        const { error } = await supabase
          .from('srs_cards')
          .upsert({
            word_ref: localCard.wordRef,
            card_type: localCard.cardType,
            interval: item.entityData.interval,
            ease_factor: item.entityData.easeFactor,
            repetitions: item.entityData.repetitions,
            due_date: new Date(item.entityData.dueDate).toISOString().split('T')[0],
            user_id: userId
          }, { onConflict: 'deck_id,word_ref,card_type' })

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
