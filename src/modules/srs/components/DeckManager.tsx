import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, ArrowRight, Layers, RotateCcw, Pencil, Trash2 } from 'lucide-react'
import { db } from '../../../core/db/dictionaryDb'
import type { Deck, SrsCard } from '../../../core/db/dictionaryDb'
import { syncEngine } from '../../../core/sync/syncEngine'

interface DeckWithStats extends Deck {
  totalCount: number
  dueCount: number
}

interface DeckManagerProps {
  onStartReview: (deckId: number) => void
}

export const DeckManager: React.FC<DeckManagerProps> = ({ onStartReview }) => {
  const [decks, setDecks] = useState<DeckWithStats[]>([])
  const [newDeckName, setNewDeckName] = useState('')
  const [editingDeckId, setEditingDeckId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function loadDecks() {
    try {
      const list = await db.decks.toArray()
      const now = Date.now()

      const listWithStats = await Promise.all(
        list.map(async (deck) => {
          const cards = await db.srsCards.where('deckId').equals(deck.id!).toArray()
          const dueCards = cards.filter((c) => c.dueDate <= now && (c as any).state !== 'suspended')
          return {
            ...deck,
            totalCount: cards.length,
            dueCount: dueCards.length,
          }
        })
      )
      setDecks(listWithStats)
    } catch (err) {
      console.error('Failed to load decks:', err)
      setErrorMsg('Gagal memuat deck.')
    }
  }

  useEffect(() => {
    loadDecks()
  }, [])

  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newDeckName.trim()
    if (!name) return

    try {
      const deckId = await db.decks.add({
        name,
        createdAt: Date.now(),
      })

      // Sync inserts
      await db.syncQueue.add({
        action: 'insert',
        entityTable: 'decks',
        entityData: { id: deckId, name, createdAt: Date.now() },
        queuedAt: Date.now()
      })

      setNewDeckName('')
      loadDecks()
      syncEngine.triggerSync()
    } catch (err) {
      console.error('Failed to create deck:', err)
      alert('Gagal membuat deck baru.')
    }
  };

  const handleStartRename = (deck: Deck) => {
    setEditingDeckId(deck.id!)
    setEditingName(deck.name)
  };

  const handleRenameDeck = async (deckId: number) => {
    const name = editingName.trim()
    if (!name) return

    try {
      await db.decks.update(deckId, { name })
      
      await db.syncQueue.add({
        action: 'update',
        entityTable: 'decks',
        entityData: { id: deckId, name },
        queuedAt: Date.now()
      })

      setEditingDeckId(null)
      loadDecks()
      syncEngine.triggerSync()
    } catch (err) {
      console.error('Failed to rename deck:', err)
      alert('Gagal mengubah nama deck.')
    }
  };

  const handleDeleteDeck = async (deckId: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus deck ini beserta seluruh kartu di dalamnya?')) {
      return
    }

    try {
      await db.transaction('rw', [db.decks, db.srsCards, db.syncQueue], async () => {
        // Capture serverId before deleting — needed by syncEngine to delete the remote row.
        const existingDeck = await db.decks.get(deckId)

        await db.decks.delete(deckId)
        await db.srsCards.where('deckId').equals(deckId).delete()

        await db.syncQueue.add({
          action: 'delete',
          entityTable: 'decks',
          entityData: { id: deckId, serverId: existingDeck?.serverId },
          queuedAt: Date.now()
        })
      })

      loadDecks()
      syncEngine.triggerSync()
    } catch (err) {
      console.error('Failed to delete deck:', err)
      alert('Gagal menghapus deck.')
    }
  };

  // FR-SRS-21: browse the cards inside a deck directly in-app (replaces the
  // CSV export removed in this delta — BR-SRS-13).
  const [expandedDeckId, setExpandedDeckId] = useState<number | null>(null)
  const [deckCards, setDeckCards] = useState<(SrsCard & { lemma: string })[]>([])

  async function loadDeckCards(deckId: number) {
    const cards = await db.srsCards.where('deckId').equals(deckId).toArray()
    const withLemma = await Promise.all(
      cards.map(async (card) => {
        const word = await db.dictionary.where('lemma').equals(card.wordRef).first()
        return { ...card, lemma: word?.lemma || card.wordRef }
      })
    )
    setDeckCards(withLemma)
  }

  const handleToggleBrowse = async (deckId: number) => {
    if (expandedDeckId === deckId) {
      setExpandedDeckId(null)
      setDeckCards([])
      return
    }
    setExpandedDeckId(deckId)
    await loadDeckCards(deckId)
  };

  // FR-SRS-20: remove a single card from a deck without deleting the deck.
  const handleDeleteCard = async (card: SrsCard) => {
    if (!confirm(`Hapus kartu "${card.wordRef}" (${card.cardType}) dari deck ini?`)) return

    try {
      await db.transaction('rw', [db.srsCards, db.syncQueue], async () => {
        await db.srsCards.delete(card.id!)
        // srs_cards has no local serverId tracking -- capture the natural key
        // (deckId/wordRef/cardType) now, since the local row is gone by the
        // time syncEngine pushes this (see syncEngine.ts srsCards delete handler).
        await db.syncQueue.add({
          action: 'delete',
          entityTable: 'srsCards',
          entityData: { deckId: card.deckId, wordRef: card.wordRef, cardType: card.cardType },
          queuedAt: Date.now(),
        })
      })
      syncEngine.triggerSync()
      loadDecks()
      await loadDeckCards(card.deckId)
    } catch (err) {
      console.error('Failed to delete card:', err)
      alert('Gagal menghapus kartu.')
    }
  };

  // FR-SRS-22/BR-SRS-12: reset every card's schedule back to new, without
  // deleting any card. Defaults mirror generateCardsForWord (srsScheduler.ts).
  const handleResetProgress = async (deckId: number) => {
    if (!confirm('Reset progress SEMUA kartu di deck ini? Kartu TIDAK akan dihapus, tapi jadwal belajarnya dimulai ulang dari awal.')) return

    try {
      const cards = await db.srsCards.where('deckId').equals(deckId).toArray()
      const now = Date.now()
      await db.transaction('rw', [db.srsCards, db.syncQueue], async () => {
        for (const card of cards) {
          await db.srsCards.update(card.id!, {
            interval: 0,
            easeFactor: 2.5,
            repetitions: 0,
            dueDate: now,
            updatedAt: now,
          })
          await db.syncQueue.add({
            action: 'update',
            entityTable: 'srsCards',
            entityData: { id: card.id!, interval: 0, easeFactor: 2.5, repetitions: 0, dueDate: now, updatedAt: now },
            queuedAt: Date.now(),
          })
        }
      })
      syncEngine.triggerSync()
      loadDecks()
      if (expandedDeckId === deckId) await loadDeckCards(deckId)
    } catch (err) {
      console.error('Failed to reset deck progress:', err)
      alert('Gagal mereset progress deck.')
    }
  };

  return (
    <div className="max-w-xl mx-auto text-left">
      <p className="eyebrow">Spaced Repetition</p>
      <h1 className="page-title text-3xl mt-1.5 mb-6">Flashcards</h1>

      {errorMsg && (
        <div className="p-3 rounded-xl border text-sm mb-4 text-danger bg-danger-soft border-danger">
          {errorMsg}
        </div>
      )}

      <Link
        to="/statistik"
        className="mb-6 flex items-center justify-between rounded-2xl border border-border p-4 hover:bg-surface-muted transition-colors"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><BarChart3 className="w-5 h-5" /></span>
          <span>
            <span className="block font-display font-bold text-sm">Lihat Statistik Lengkap</span>
            <span className="block text-xs text-ink-faint">Streak, akurasi, dan aktivitas belajarmu</span>
          </span>
        </span>
        <ArrowRight className="w-4 h-4 text-brand shrink-0" />
      </Link>

      {/* Create Deck Form */}
      <form onSubmit={handleCreateDeck} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Nama deck baru (mis. Kosakata Kerja)..."
          className="field-input flex-1 text-sm"
          value={newDeckName}
          onChange={(e) => setNewDeckName(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary text-sm whitespace-nowrap">
          Buat Deck
        </button>
      </form>

      {/* Decks List */}
      <div className="flex flex-col gap-4">
        {decks.length === 0 ? (
          <div className="text-sm text-ink-faint italic text-center py-12 border border-dashed border-border rounded-xl">
            Belum ada deck belajar. Buat deck baru menggunakan form di atas untuk mulai menambahkan kartu.
          </div>
        ) : (
          decks.map((deck) => (
            <div key={deck.id} className="card p-6 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex-1">
                  {editingDeckId === deck.id ? (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        className="field-input !w-auto text-sm py-1.5"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                      />
                      <button onClick={() => handleRenameDeck(deck.id!)} className="text-xs font-display font-bold text-brand hover:underline">
                        Simpan
                      </button>
                      <button onClick={() => setEditingDeckId(null)} className="text-xs text-ink-faint hover:underline">
                        Batal
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-display font-bold text-ink text-lg">{deck.name}</h3>
                      <div className="flex gap-3 text-xs text-ink-faint mt-1.5 font-medium">
                        <span>Total: {deck.totalCount} kartu</span>
                        <span>•</span>
                        <span className={deck.dueCount > 0 ? 'text-brand font-bold' : ''}>
                          Due: {deck.dueCount} kartu
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-4 justify-end flex-wrap">
                  {editingDeckId !== deck.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleBrowse(deck.id!)}
                        title={expandedDeckId === deck.id ? 'Tutup daftar kartu' : 'Lihat isi kartu'}
                        aria-label={expandedDeckId === deck.id ? 'Tutup daftar kartu' : 'Lihat isi kartu'}
                        aria-pressed={expandedDeckId === deck.id}
                        className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${expandedDeckId === deck.id ? 'bg-brand-soft text-brand' : 'text-ink-muted hover:bg-surface-muted hover:text-brand'}`}
                      >
                        <Layers className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleResetProgress(deck.id!)}
                        title="Reset progress"
                        aria-label="Reset progress"
                        className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-surface-muted hover:text-brand transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStartRename(deck)}
                        title="Ubah nama"
                        aria-label="Ubah nama"
                        className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-surface-muted hover:text-brand transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDeck(deck.id!)}
                        title="Hapus deck"
                        aria-label="Hapus deck"
                        className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-danger-soft hover:text-danger transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => onStartReview(deck.id!)}
                    className={deck.dueCount > 0 ? 'btn-primary !py-2.5 !px-5 text-xs shrink-0' : 'btn-secondary !py-2.5 !px-5 text-xs shrink-0'}
                  >
                    {deck.dueCount > 0 ? 'Mulai Belajar' : 'Buka Deck'}
                  </button>
                </div>
              </div>

              {/* FR-SRS-21: browse kartu di dalam deck */}
              {expandedDeckId === deck.id && (
                <div className="border-t border-border pt-4">
                  {deckCards.length === 0 ? (
                    <p className="text-xs text-ink-faint italic">Deck ini belum punya kartu.</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                      {deckCards.map((card) => {
                        const isDue = card.dueDate <= Date.now()
                        return (
                          <li key={card.id} className="flex items-center justify-between gap-3 text-xs py-1.5 px-2 rounded-lg hover:bg-surface-muted">
                            <span className="flex-1 min-w-0 truncate">
                              <span className="font-semibold text-ink">{card.lemma}</span>
                              <span className="text-ink-faint"> · {card.cardType}</span>
                            </span>
                            <span className={isDue ? 'text-brand font-semibold shrink-0' : 'text-ink-faint shrink-0'}>
                              {isDue ? 'Due' : 'Belum due'}
                            </span>
                            <button
                              onClick={() => handleDeleteCard(card)}
                              className="text-ink-faint hover:text-danger transition font-semibold shrink-0"
                            >
                              Hapus
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
export default DeckManager
