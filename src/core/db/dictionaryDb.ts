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
  entityTable: 'decks' | 'srsCards' | 'reviewLogs'
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

    this.version(4).stores({
      srsCards: '++id, deckId, wordRef, cardType, dueDate',
      mistakeTracker: 'wordRef, mistakeCount, lastMistakeAt'
    })
  }
}

export const db = new DictionaryDatabase()
