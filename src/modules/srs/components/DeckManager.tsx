import React, { useState, useEffect } from 'react'
import { db } from '../../../core/db/dictionaryDb'
import type { Deck } from '../../../core/db/dictionaryDb'
import { topMistakes } from './mistakeStats'

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

  // Statistics states (S7-01 & S8-01)
  const [streak, setStreak] = useState(0)
  const [reviewsToday, setReviewsToday] = useState(0)
  const [showDetailedStats, setShowDetailedStats] = useState(false)
  const [totalStudiedWords, setTotalStudiedWords] = useState(0)
  const [accuracyByPos, setAccuracyByPos] = useState<Record<string, { total: number; correct: number }>>({})
  const [weeklyActivity, setWeeklyActivity] = useState<{ date: string; count: number }[]>([])
  const [mistakeWords, setMistakeWords] = useState<{ lemma: string; mistakeCount: number }[]>([])

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

      // Calculate streak & reviews today (S7-05 offline calculation)
      const logs = await db.reviewLogs.orderBy('reviewedAt').toArray()
      const startOfDay = new Date().setHours(0, 0, 0, 0)
      
      const todayLogs = logs.filter(l => l.reviewedAt >= startOfDay)
      setReviewsToday(todayLogs.length)

      let currentStreak = 0
      const activeDays = new Set(
        logs.map((l) => new Date(l.reviewedAt).toDateString())
      )

      let checkDate = new Date()
      const todayStr = checkDate.toDateString()
      if (!activeDays.has(todayStr)) {
        checkDate.setDate(checkDate.getDate() - 1)
      }

      while (activeDays.has(checkDate.toDateString())) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      }
      setStreak(currentStreak)

      // Calculate Detailed Stats (S8-01)
      const studiedCardIds = new Set(logs.map((l) => l.cardId))
      const studiedWords = new Set<string>()
      const accuracyMap: Record<string, { total: number; correct: number }> = {}

      for (const cardId of studiedCardIds) {
        const card = await db.srsCards.get(cardId)
        if (card) {
          studiedWords.add(card.wordRef)
          const word = await db.dictionary.where('lemma').equals(card.wordRef).first()
          const pos = word?.pos?.toLowerCase() || 'lainnya'
          
          const cardLogs = logs.filter((l) => l.cardId === cardId)
          for (const log of cardLogs) {
            if (!accuracyMap[pos]) {
              accuracyMap[pos] = { total: 0, correct: 0 }
            }
            accuracyMap[pos].total++
            if (log.rating >= 3) {
              accuracyMap[pos].correct++
            }
          }
        }
      }
      setTotalStudiedWords(studiedWords.size)
      setAccuracyByPos(accuracyMap)

      // 7-day activity log
      const last7Days: { date: string; count: number }[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toDateString()
        const count = logs.filter((l) => new Date(l.reviewedAt).toDateString() === dateStr).length
        last7Days.push({
          date: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
          count
        })
      }
      setWeeklyActivity(last7Days)

      // Top frequently-wrong words (FR-STAT-03)
      const mistakes = await db.mistakeTracker.toArray()
      setMistakeWords(topMistakes(mistakes).map((m) => ({ lemma: m.wordRef, mistakeCount: m.mistakeCount })))

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
    <div className="max-w-xl mx-auto my-6 text-left px-4">
      <h1 className="text-3xl font-extrabold text-gray-900 dark:text-slate-100 mb-6">SRS Spaced Repetition</h1>

      {errorMsg && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-sm mb-4">
          {errorMsg}
        </div>
      )}

      {/* Dashboard Statistik */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="text-3xl">🔥</div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase">Streak Belajar</div>
            <div className="text-lg font-extrabold text-gray-900 dark:text-slate-100">{streak} Hari Beruntun</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-center gap-3">
          <div className="text-3xl">⚡</div>
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase">Dipelajari Hari Ini</div>
            <div className="text-lg font-extrabold text-gray-900 dark:text-slate-100">{reviewsToday} Kartu</div>
          </div>
        </div>
      </div>

      {/* Detailed Stats Panel (S8-01) */}
      <div className="mb-6">
        <button
          onClick={() => setShowDetailedStats(!showDetailedStats)}
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {showDetailedStats ? 'Sembunyikan Statistik Lanjut' : 'Tampilkan Statistik Lanjut'}
        </button>

        {showDetailedStats && (
          <div className="mt-4 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <div>
              <div className="text-xs text-gray-400 font-semibold uppercase mb-1">Total Kata Dipelajari (SRS)</div>
              <div className="text-2xl font-extrabold text-indigo-600">{totalStudiedWords} Kosakata</div>
            </div>

            <div>
              <div className="text-xs text-gray-400 font-semibold uppercase mb-2">Akurasi per Kategori Kata</div>
              <div className="flex flex-col gap-2">
                {Object.entries(accuracyByPos).map(([pos, data]) => {
                  const rate = Math.round((data.correct / data.total) * 100)
                  return (
                    <div key={pos} className="flex justify-between items-center text-xs">
                      <span className="capitalize font-semibold text-gray-700 dark:text-slate-300">{pos}</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{rate}% ({data.correct}/{data.total})</span>
                    </div>
                  )
                })}
                {Object.keys(accuracyByPos).length === 0 && (
                  <div className="text-xs text-gray-400 italic">Belum ada data akurasi.</div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-400 font-semibold uppercase mb-2">Aktivitas Belajar 7 Hari Terakhir</div>
              <div className="flex justify-between items-end h-20 bg-gray-50 dark:bg-slate-950 p-3 rounded-lg border dark:border-slate-850">
                {weeklyActivity.map((day) => {
                  const barHeight = Math.min(100, (day.count / 20) * 100)
                  return (
                    <div key={day.date} className="flex flex-col items-center gap-1.5 flex-1">
                      <div className="w-4 bg-indigo-600 rounded-t-xs" style={{ height: `${barHeight || 4}px` }} />
                      <span className="text-[9px] text-gray-400">{day.count}</span>
                      <span className="text-[8px] uppercase text-gray-400 font-bold">{day.date}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-400 font-semibold uppercase mb-2">Kata Paling Sering Salah</div>
              <div className="flex flex-col gap-1.5">
                {mistakeWords.map((w) => (
                  <div key={w.lemma} className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-gray-700 dark:text-slate-300">{w.lemma}</span>
                    <span className="font-bold text-red-600">{w.mistakeCount}x salah</span>
                  </div>
                ))}
                {mistakeWords.length === 0 && (
                  <div className="text-xs text-gray-400 italic">Belum ada data kesalahan.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Deck Form */}
      <form onSubmit={handleCreateDeck} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Nama deck baru (mis. Kosakata Kerja)..."
          className="flex-1 bg-white dark:bg-slate-900 text-gray-950 dark:text-slate-100 border border-gray-300 dark:border-slate-850 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          value={newDeckName}
          onChange={(e) => setNewDeckName(e.target.value)}
          required
        />
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition shadow-sm"
        >
          Buat Deck
        </button>
      </form>

      {/* Decks List */}
      <div className="flex flex-col gap-4">
        {decks.length === 0 ? (
          <div className="text-sm text-gray-400 italic text-center py-12 border border-dashed rounded-xl bg-white dark:bg-slate-900">
            Belum ada deck belajar. Buat deck baru menggunakan form di atas untuk mulai menambahkan kartu.
          </div>
        ) : (
          decks.map((deck) => (
            <div key={deck.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div className="flex-1">
                {editingDeckId === deck.id ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      className="bg-white text-gray-950 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                    />
                    <button
                      onClick={() => handleRenameDeck(deck.id!)}
                      className="text-xs font-bold text-indigo-600 hover:underline"
                    >
                      Simpan
                    </button>
                    <button
                      onClick={() => setEditingDeckId(null)}
                      className="text-xs text-gray-400 hover:underline"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="font-extrabold text-gray-900 dark:text-slate-100 text-lg">{deck.name}</h3>
                    <div className="flex gap-3 text-xs text-gray-400 mt-1.5 font-medium">
                      <span>Total: {deck.totalCount} kartu</span>
                      <span>•</span>
                      <span className={deck.dueCount > 0 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}>
                        Due: {deck.dueCount} kartu
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 justify-end flex-wrap">
                {editingDeckId !== deck.id && (
                  <>
                    <button
                      onClick={() => handleExportDeck(deck.id!, deck.name)}
                      className="text-xs text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition font-semibold"
                      title="Ekspor deck ke CSV"
                    >
                      Ekspor CSV
                    </button>
                    <button
                      onClick={() => handleStartRename(deck)}
                      className="text-xs text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition font-semibold"
                    >
                      Ubah Nama
                    </button>
                    <button
                      onClick={() => handleDeleteDeck(deck.id!)}
                      className="text-xs text-gray-500 hover:text-red-650 transition font-semibold"
                    >
                      Hapus
                    </button>
                  </>
                )}
                
                <button
                  disabled={deck.dueCount === 0}
                  onClick={() => onStartReview(deck.id!)}
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold transition ${
                    deck.dueCount > 0
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed border dark:border-slate-850'
                  }`}
                >
                  Mulai Belajar
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
