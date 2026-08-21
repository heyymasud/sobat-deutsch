import Dexie, { type Table } from 'dexie'
import type { DictionaryEntry } from '../../modules/dictionary/types'

export interface DictSyncMeta {
  id?: number
  localVersion: number
  downloadState: 'idle' | 'downloading' | 'verifying' | 'failed'
  downloadProgress: number
  lastCheckedAt: number
  rowCount?: number
  checksum?: string
}

export interface Deck {
  id?: number
  name: string
  createdAt: number
  serverId?: string // uuid of matching row in public.decks, set after first successful sync
}

export interface SrsCard {
  id?: number
  deckId: number
  wordRef: string
  cardType: 'gender' | 'plural' | 'konjugasi' | 'cloze-kasus' | 'arti'
  interval: number // in days
  easeFactor: number
  repetitions: number
  dueDate: number // timestamp
  createdAt: number
  updatedAt: number // last-modified timestamp, used for last-write-wins conflict resolution (S9-01, BR-SYNC-02)
  state?: 'new' | 'learning' | 'review' | 'suspended'
}

export interface ReviewLog {
  id?: number
  cardId: number
  rating: number
  easeFactor: number
  interval: number
  reviewedAt: number
}

export interface SyncQueueItem {
  id?: number
  action: 'insert' | 'update' | 'delete'
  entityTable: 'decks' | 'srsCards' | 'reviewLogs' | 'mistakeTracker'
  entityData: any
  queuedAt: number
}

export interface MistakeTrackerEntry {
  wordRef: string
  mistakeCount: number
  recommendedToDeck: boolean
  lastMistakeAt: number
}

export class DictionaryDatabase extends Dexie {
  dictionary!: Table<DictionaryEntry, number>
  dictionaryStaging!: Table<DictionaryEntry, number>
  dictSyncMeta!: Table<DictSyncMeta, number>
  
  decks!: Table<Deck, number>
  srsCards!: Table<SrsCard, number>
  reviewLogs!: Table<ReviewLog, number>
  syncQueue!: Table<SyncQueueItem, number>
  
  mistakeTracker!: Table<MistakeTrackerEntry, string>

  constructor() {
    super('DeutschDeckDB')
    
    this.version(1).stores({
      dictionary: 'id, lemma, pos, gender, plural, frequency_rank, level',
      dictionaryStaging: 'id, lemma, pos, gender, plural, frequency_rank, level',
      dictSyncMeta: '++id, localVersion, downloadState'
    })

    this.version(2).stores({
      decks: '++id, name, createdAt',
      srsCards: '++id, deckId, wordId, cardType, dueDate',
      reviewLogs: '++id, cardId, reviewedAt',
      syncQueue: '++id, action, entityTable, queuedAt'
    })

    this.version(3).stores({
      mistakeTracker: 'wordId, mistakeCount, lastMistakeAt'
    })

    // mistakeTracker's primary key changed from `wordId` (v3) to `wordRef` (below) --
    // Dexie can't rename a primary key in place, only delete-then-recreate the table.
    // Drop the old wordId-keyed table here...
    this.version(4).stores({
      srsCards: '++id, deckId, wordRef, cardType, dueDate',
      mistakeTracker: null
    })

    // ...and recreate it fresh under the new key. Any pre-4 mistake-tracking data
    // is lost (acceptable: it's a non-critical recommendation heuristic, not user
    // progress), but this at least lets the DB actually open instead of throwing
    // "UpgradeError: Not yet support for changing primary key" for every browser
    // that had reached version 3 before this fix.
    this.version(4.1).stores({
      mistakeTracker: 'wordRef, mistakeCount, lastMistakeAt'
    })

    // S9-01: add updatedAt for last-write-wins sync conflict resolution.
    // Backfill existing rows with createdAt (best available approximation) so
    // pre-existing local cards don't get treated as "never updated" (epoch 0).
    this.version(5).stores({
      srsCards: '++id, deckId, wordRef, cardType, dueDate, updatedAt'
    }).upgrade((tx) => {
      return tx.table('srsCards').toCollection().modify((card) => {
        if (!card.updatedAt) card.updatedAt = card.createdAt || Date.now()
      })
    })
  }
}

export const db = new DictionaryDatabase()
