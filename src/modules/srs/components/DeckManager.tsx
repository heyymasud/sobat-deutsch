import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, ArrowRight } from 'lucide-react'
import { db } from '../../../core/db/dictionaryDb'
import type { Deck } from '../../../core/db/dictionaryDb'
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

  const handleExportDeck = async (deckId: number, deckName: string) => {
    try {
      const cards = await db.srsCards.where('deckId').equals(deckId).toArray()
      if (cards.length === 0) {
        alert('Deck ini kosong, tidak ada kartu untuk diekspor.')
        return
      }

      const headers = ['Card ID', 'Lemma', 'POS', 'Card Type', 'Interval (Days)', 'Ease Factor', 'Repetitions', 'Due Date']
      const rows = [headers]

      for (const card of cards) {
        const word = await db.dictionary.where('lemma').equals(card.wordRef).first()
        rows.push([
          card.id?.toString() || '',
          word?.lemma || '',
          word?.pos || '',
          card.cardType,
          card.interval.toString(),
          card.easeFactor.toString(),
          card.repetitions.toString(),
          new Date(card.dueDate).toISOString()
        ])
      }

      const csvContent = rows
        .map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(','))
        .join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `${deckName.replace(/\s+/g, '_')}_export.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Failed to export deck:', err)
      alert('Gagal mengekspor deck.')
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
            <div key={deck.id} className="card p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
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

              <div className="flex items-center gap-3 justify-end flex-wrap">
                {editingDeckId !== deck.id && (
                  <>
                    <button onClick={() => handleExportDeck(deck.id!, deck.name)} className="text-xs text-ink-muted hover:text-brand transition font-semibold">
                      Ekspor CSV
                    </button>
                    <button onClick={() => handleStartRename(deck)} className="text-xs text-ink-muted hover:text-brand transition font-semibold">
                      Ubah Nama
                    </button>
                    <button onClick={() => handleDeleteDeck(deck.id!)} className="text-xs text-ink-muted hover:text-danger transition font-semibold">
                      Hapus
                    </button>
                  </>
                )}

                <button
                  onClick={() => onStartReview(deck.id!)}
                  className={deck.dueCount > 0 ? 'btn-primary !py-2.5 !px-5 text-xs' : 'btn-secondary !py-2.5 !px-5 text-xs'}
                >
                  {deck.dueCount > 0 ? 'Mulai Belajar' : 'Buka Deck'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
export default DeckManager
