import React, { useState, useEffect, useCallback } from 'react'
import { db } from '../../../core/db/dictionaryDb'
import type { SrsCard, ReviewLog } from '../../../core/db/dictionaryDb'
import { calculateSm2, interleaveByKey, shouldShowPatternDrill, calculateAccuracy, isSessionStateFresh } from '../../../core/srs/srsScheduler'
import type { DictionaryEntry } from '../../dictionary/types'
import { syncEngine } from '../../../core/sync/syncEngine'

interface ReviewItem {
  card: SrsCard
  word: DictionaryEntry
}

interface ReviewSessionProps {
  deckId: number
  onFinish: () => void
}

interface SessionSummary {
  reviewed: number
  accuracy: number
  dueTomorrow: number
}

// S9-07 (AC-SRS-11): kunci localStorage untuk resume sesi persis dari posisi terakhir.
const sessionStateKey = (deckId: number) => `srs_session_state_${deckId}`

interface PersistedSessionState {
  cardIds: number[]
  currentIndex: number
  savedAt: number
}

const loadPersistedSession = (deckId: number): PersistedSessionState | null => {
  try {
    const raw = localStorage.getItem(sessionStateKey(deckId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedSessionState
    if (!isSessionStateFresh(parsed.savedAt, Date.now())) return null
    if (!Array.isArray(parsed.cardIds)) return null
    return parsed
  } catch {
    return null
  }
}

const savePersistedSession = (deckId: number, cardIds: number[], currentIndex: number) => {
  const state: PersistedSessionState = { cardIds, currentIndex, savedAt: Date.now() }
  localStorage.setItem(sessionStateKey(deckId), JSON.stringify(state))
}

const clearPersistedSession = (deckId: number) => {
  localStorage.removeItem(sessionStateKey(deckId))
}

// S9-05 (AC-SRS-07, BR-SRS-07): kunci localStorage untuk ablaut_class yang sudah
// pernah ditampilkan Pattern Drill-nya (per device, tidak perlu sync ke server).
const SEEN_ABLAUT_CLASSES_KEY = 'seen_ablaut_classes'

const loadSeenAblautClasses = (): Set<string> => {
  try {
    const raw = localStorage.getItem(SEEN_ABLAUT_CLASSES_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

const saveSeenAblautClasses = (classes: Set<string>) => {
  localStorage.setItem(SEEN_ABLAUT_CLASSES_KEY, JSON.stringify([...classes]))
}

export const ReviewSession: React.FC<ReviewSessionProps> = ({ deckId, onFinish }) => {
  const [queue, setQueue] = useState<ReviewItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [seenAblautClasses, setSeenAblautClasses] = useState<Set<string>>(() => loadSeenAblautClasses())
  const [sessionRatings, setSessionRatings] = useState<number[]>([])
  const [summary, setSummary] = useState<SessionSummary | null>(null)

  const loadSessionQueue = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    setSummary(null)
    setSessionRatings([])
    try {
      // 0. S9-07 (AC-SRS-11): kalau ada sesi in-progress yang belum basi, resume
      // PERSIS dari posisi terakhir alih-alih re-derive antrean due dari awal.
      const persisted = loadPersistedSession(deckId)
      if (persisted && persisted.cardIds.length > 0) {
        const items: ReviewItem[] = []
        for (const cardId of persisted.cardIds) {
          const card = await db.srsCards.get(cardId)
          if (!card || (card as any).state === 'suspended') continue
          const word = await db.dictionary.where('lemma').equals(card.wordRef).first()
          if (word) items.push({ card, word })
        }
        if (items.length > 0) {
          setQueue(items)
          setCurrentIndex(Math.min(persisted.currentIndex, items.length - 1))
          setShowAnswer(false)
          setLoading(false)
          return
        }
        // Semua kartu tersimpan sudah tidak valid (mis. sudah disuspend) -> buang state basi.
        clearPersistedSession(deckId)
      }

      // 1. Fetch daily limit configuration (S7-03)
      const dailyNewLimit = parseInt(localStorage.getItem('daily_new_limit') || '20', 10)
      const dailyReviewLimit = parseInt(localStorage.getItem('daily_review_limit') || '100', 10)

      // 2. Count card reviews done today (S7-05 offline calculation)
      const startOfDay = new Date().setHours(0, 0, 0, 0)
      const logsToday = await db.reviewLogs
        .where('reviewedAt')
        .aboveOrEqual(startOfDay)
        .toArray()

      // Count new vs review cards completed today
      const cardIdsToday = new Set(logsToday.map(log => log.cardId))
      let newCompletedCount = 0
      let reviewCompletedCount = 0

      for (const cardId of cardIdsToday) {
        const card = await db.srsCards.get(cardId)
        if (card) {
          if (card.repetitions <= 1) {
            newCompletedCount++
          } else {
            reviewCompletedCount++
          }
        }
      }

      const remainingNew = Math.max(0, dailyNewLimit - newCompletedCount)
      const remainingReview = Math.max(0, dailyReviewLimit - reviewCompletedCount)

      // 3. Fetch cards due for review in this deck
      const now = Date.now()
      const cards = await db.srsCards
        .where('deckId')
        .equals(deckId)
        .toArray()

      const filteredDue = cards.filter((c) => c.dueDate <= now && (c as any).state !== 'suspended')

      // Separate new vs review cards in the due cards list
      const dueNewCards = filteredDue.filter((c) => c.repetitions === 0)
      const dueReviewCards = filteredDue.filter((c) => c.repetitions > 0)

      // Slice each list to fit remaining counts
      const limitedNew = dueNewCards.slice(0, remainingNew)
      const limitedReview = dueReviewCards.slice(0, remainingReview)

      const finalCards = [...limitedNew, ...limitedReview]

      if (finalCards.length === 0) {
        setQueue([])
        setLoading(false)
        return
      }

      // 4. Fetch full word data for each card
      const items: ReviewItem[] = []
      for (const card of finalCards) {
        const word = await db.dictionary.where('lemma').equals(card.wordRef).first()
        if (word) {
          items.push({ card, word })
        }
      }

      // 5. Base order: kartu baru berdasarkan frequency_rank (BR-SRS-02), kartu
      // review berdasarkan due date (paling telat duluan). TIDAK pernah tema (BR-SRS-04).
      items.sort((a, b) => {
        const aIsNew = a.card.repetitions === 0
        const bIsNew = b.card.repetitions === 0
        if (aIsNew !== bIsNew) return aIsNew ? -1 : 1
        if (aIsNew) {
          const rankA = a.word.frequency_rank || 999999
          const rankB = b.word.frequency_rank || 999999
          return rankA - rankB
        }
        return a.card.dueDate - b.card.dueDate
      })

      // 6. Interleave supaya tidak ada run panjang ablaut_class yang sama
      // berturut-turut (FR-SRS-09/10, BR-SRS-03) — bukan berdasarkan tema (BR-SRS-04).
      const interleaved = interleaveByKey(items, (item) => item.word.ablaut_class)

      setQueue(interleaved)
      setCurrentIndex(0)
      setShowAnswer(false)
      savePersistedSession(deckId, interleaved.map((i) => i.card.id!), 0)
    } catch (err) {
      console.error('Failed to load review queue:', err)
      setErrorMsg('Gagal memuat kartu belajar.')
    } finally {
      setLoading(false)
    }
  }, [deckId]);

  useEffect(() => {
    loadSessionQueue()
  }, [loadSessionQueue])

  // S9-05 (AC-SRS-07): setelah kartu arti kata kerja dengan ablaut_class baru
  // ditampilkan, tandai kelasnya sebagai sudah dilihat supaya Pattern Drill
  // tidak muncul lagi untuk kelas yang sama di kartu-kartu berikutnya.
  useEffect(() => {
    const currentItem = queue[currentIndex]
    if (!showAnswer || !currentItem) return
    const ablautClass = currentItem.word.ablaut_class
    if (ablautClass && shouldShowPatternDrill(ablautClass, seenAblautClasses)) {
      const updated = new Set(seenAblautClasses)
      updated.add(ablautClass)
      setSeenAblautClasses(updated)
      saveSeenAblautClasses(updated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnswer, currentIndex, queue])

  const handlePlayAudio = (lemma: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(lemma)
      utterance.lang = 'de-DE'
      window.speechSynthesis.speak(utterance)
    }
  };

  const finishSession = useCallback(async (ratings: number[]) => {
    // S9-06 (AC-SRS-09, FR-SRS-15): layar ringkasan sungguhan, bukan alert().
    let dueTomorrow = 0
    try {
      const tomorrowEnd = new Date().setHours(24, 0, 0, 0) + 24 * 60 * 60 * 1000
      const cards = await db.srsCards.where('deckId').equals(deckId).toArray()
      dueTomorrow = cards.filter((c) => (c as any).state !== 'suspended' && c.dueDate <= tomorrowEnd).length
    } catch (err) {
      console.error('Failed to compute next-review schedule:', err)
    }
    clearPersistedSession(deckId)
    setSummary({
      reviewed: ratings.length,
      accuracy: calculateAccuracy(ratings),
      dueTomorrow,
    })
  }, [deckId]);

  const handleRating = useCallback(async (rating: number) => {
    if (queue.length === 0) return
    const currentItem = queue[currentIndex]
    if (!currentItem) return
    const { card } = currentItem

    // Calculate next SM-2 state
    const nextState = calculateSm2(rating, card.interval, card.easeFactor, card.repetitions)

    try {
      await db.transaction('rw', [db.srsCards, db.reviewLogs, db.syncQueue], async () => {
        // 1. Update SrsCard
        const updatedAt = Date.now()
        await db.srsCards.update(card.id!, {
          interval: nextState.interval,
          easeFactor: nextState.easeFactor,
          repetitions: nextState.repetitions,
          dueDate: nextState.dueDate,
          updatedAt,
        })

        // 2. Write to ReviewLog
        const log: Omit<ReviewLog, 'id'> = {
          cardId: card.id!,
          rating,
          easeFactor: nextState.easeFactor,
          interval: nextState.interval,
          reviewedAt: Date.now(),
        }
        await db.reviewLogs.add(log as any)

        // 3. Queue update action for cloud sync
        await db.syncQueue.add({
          action: 'update',
          entityTable: 'srsCards',
          entityData: { id: card.id!, ...nextState, updatedAt },
          queuedAt: Date.now(),
        })

        // 4. Queue append-only review log for cloud sync (BR-SYNC-03)
        await db.syncQueue.add({
          action: 'insert',
          entityTable: 'reviewLogs',
          entityData: { cardId: card.id!, rating, interval: nextState.interval, reviewedAt: log.reviewedAt },
          queuedAt: Date.now(),
        })
      })
      syncEngine.triggerSync()

      const updatedRatings = [...sessionRatings, rating]
      setSessionRatings(updatedRatings)

      // Move to next card
      if (currentIndex < queue.length - 1) {
        const nextIndex = currentIndex + 1
        setCurrentIndex(nextIndex)
        setShowAnswer(false)
        savePersistedSession(deckId, queue.map((i) => i.card.id!), nextIndex)
      } else {
        // Sesi selesai (S9-06: ringkasan sungguhan, bukan alert)
        await finishSession(updatedRatings)
      }
    } catch (err) {
      console.error('Failed to save card rating:', err)
      alert('Gagal menyimpan kemajuan belajar.')
    }
  }, [queue, currentIndex, sessionRatings, deckId, finishSession]);

  // Keyboard Shortcuts (S8-03 Keyboard Only)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (queue.length === 0 || loading || summary) return

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!showAnswer) {
          setShowAnswer(true)
          const currentItem = queue[currentIndex]
          if (currentItem) {
            handlePlayAudio(currentItem.word.lemma)
          }
        }
      } else if (showAnswer) {
        if (e.key === '1') {
          handleRating(1)
        } else if (e.key === '2') {
          handleRating(2)
        } else if (e.key === '3') {
          handleRating(3)
        } else if (e.key === '4') {
          handleRating(4)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [queue, currentIndex, showAnswer, loading, handleRating, summary])

  const handleSuspend = async () => {
    const currentItem = queue[currentIndex]
    const { card } = currentItem

    if (!confirm('Apakah Anda ingin menangguhkan (suspend) kartu ini? Kartu yang ditangguhkan tidak akan muncul lagi dalam sesi belajar.')) {
      return
    }

    try {
      await db.transaction('rw', [db.srsCards, db.syncQueue], async () => {
        const updatedAt = Date.now()
        await db.srsCards.update(card.id!, { state: 'suspended' as any, updatedAt })
        await db.syncQueue.add({
          action: 'update',
          entityTable: 'srsCards',
          entityData: { id: card.id!, interval: card.interval, easeFactor: card.easeFactor, repetitions: card.repetitions, dueDate: card.dueDate, state: 'suspended', updatedAt },
          queuedAt: Date.now()
        })
      })
      syncEngine.triggerSync()

      if (currentIndex < queue.length - 1) {
        const nextIndex = currentIndex + 1
        setCurrentIndex(nextIndex)
        setShowAnswer(false)
        savePersistedSession(deckId, queue.map((i) => i.card.id!), nextIndex)
      } else {
        await finishSession(sessionRatings)
      }
    } catch (err) {
      console.error(err)
      alert('Gagal menangguhkan kartu.')
    }
  };

  const handleSummaryDone = () => {
    setSummary(null)
    onFinish()
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500">
        <svg className="animate-spin h-8 w-8 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Memuat sesi belajar...
      </div>
    )
  }

  if (errorMsg) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 my-6 max-w-xl mx-auto text-left">
        {errorMsg}
      </div>
    )
  }

  // S9-06 (AC-SRS-09, FR-SRS-15): layar ringkasan sesi sungguhan setelah kartu terakhir dinilai.
  if (summary) {
    return (
      <div className="max-w-md mx-auto my-6 px-4 text-center">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-6">Sesi Selesai!</h2>
          <div className="grid grid-cols-1 gap-4 text-left mb-6">
            <div className="flex justify-between items-center border-b dark:border-slate-800 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Kartu direview</span>
              <span className="text-lg font-bold text-gray-900 dark:text-slate-100">{summary.reviewed}</span>
            </div>
            <div className="flex justify-between items-center border-b dark:border-slate-800 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Akurasi</span>
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{Math.round(summary.accuracy * 100)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">Jadwal berikutnya</span>
              <span className="text-lg font-bold text-gray-900 dark:text-slate-100">{summary.dueTomorrow} kartu besok</span>
            </div>
          </div>
          <button
            onClick={handleSummaryDone}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-[48px] rounded-xl transition shadow-sm text-sm"
          >
            Kembali ke Manajemen Deck
          </button>
        </div>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-2">Semua Kartu Bersih!</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Tidak ada kartu yang due untuk dipelajari di deck ini hari ini.</p>
        <button
          onClick={onFinish}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg transition"
        >
          Kembali ke Manajemen Deck
        </button>
      </div>
    )
  }

  const currentItem = queue[currentIndex]
  const { card, word } = currentItem

  const getQuestion = () => {
    switch (card.cardType) {
      case 'gender':
        return (
          <div className="text-center">
            <div className="text-sm uppercase text-gray-400 font-semibold mb-2">Tentukan Artikel Gender</div>
            <div className="text-4xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">{word.lemma}</div>
          </div>
        )
      case 'plural':
        return (
          <div className="text-center">
            <div className="text-sm uppercase text-gray-400 font-semibold mb-2">Tentukan Bentuk Plural</div>
            <div className="text-4xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">die {word.lemma}</div>
          </div>
        )
      case 'cloze-kasus':
        return (
          <div className="text-center">
            <div className="text-sm uppercase text-gray-400 font-semibold mb-2">Tebak Preposisi & Kasus Penyerta</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">{word.lemma} (...)</div>
          </div>
        )
      case 'konjugasi':
        return (
          <div className="text-center">
            <div className="text-sm uppercase text-gray-400 font-semibold mb-2">Sebutkan Konjugasi Präsens</div>
            <div className="text-3xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">{word.lemma}</div>
          </div>
        )
      case 'arti':
      default:
        return (
          <div className="text-center">
            <div className="text-sm uppercase text-gray-400 font-semibold mb-2">Apa arti kata ini?</div>
            <div className="text-4xl font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">{word.lemma}</div>
          </div>
        )
    }
  };

  const getAnswer = () => {
    switch (card.cardType) {
      case 'gender':
        const genderArticle = word.gender === 'm' ? 'der' : word.gender === 'f' ? 'die' : word.gender === 'n' ? 'das' : 'N/A'
        return (
          <div className="text-center">
            <div className="text-sm uppercase text-gray-400 font-semibold mb-2">Artikel:</div>
            <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">{genderArticle} {word.lemma}</div>
          </div>
        )
      case 'plural':
        return (
          <div className="text-center">
            <div className="text-sm uppercase text-gray-400 font-semibold mb-2">Bentuk Plural:</div>
            <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">die {word.plural || 'data tidak tersedia'}</div>
          </div>
        )
      case 'cloze-kasus':
        return (
          <div className="text-center">
            <div className="text-sm uppercase text-gray-400 font-semibold mb-2">Kasus Penyerta (Governance):</div>
            <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
              {word.case_governance && word.case_governance.length > 0
                ? word.case_governance.join(', ')
                : 'tidak tersedia'}
            </div>
          </div>
        )
      case 'konjugasi':
        return (
          <div className="text-center">
            <div className="text-sm uppercase text-gray-400 font-semibold mb-2">Konjugasi Kata Kerja:</div>
            {word.conjugation_table?.['praesens'] ? (
              <div className="grid grid-cols-2 gap-2 text-xs text-left max-w-xs mx-auto bg-gray-50 dark:bg-slate-900 p-3 rounded-lg border dark:border-slate-800">
                {Object.entries(word.conjugation_table['praesens']).map(([person, form]) => (
                  <div key={person} className="flex justify-between border-b dark:border-slate-850 pb-1">
                    <span className="text-gray-400">{person}</span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">{form as string}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 italic">data konjugasi tidak tersedia</div>
            )}
          </div>
        )
      case 'arti':
      default: {
        // S9-04 (AC-SRS-03, BR-SRS-05): kartu arti kata kerja tidak boleh diam-diam
        // menjadi pasangan kata+arti polos kalau contoh kalimat kosong — tampilkan
        // marker eksplisit, konsisten dengan pola null-handling BR-DICT-07 di
        // WordDetail.tsx ("data tidak tersedia").
        const isVerb = word.pos?.toLowerCase() === 'verb'
        return (
          <div className="text-center px-4">
            <div className="text-sm uppercase text-gray-400 font-semibold mb-2">Terjemahan:</div>
            <div className="text-xl font-bold text-gray-900 dark:text-slate-100 leading-relaxed mb-4">{word.translations}</div>
            {word.example ? (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-900 border-l-4 border-indigo-500 rounded-r-lg italic text-left text-sm text-gray-700 dark:text-slate-300">
                {word.example}
              </div>
            ) : isVerb ? (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-900 border-l-4 border-gray-300 dark:border-slate-700 rounded-r-lg italic text-left text-sm text-gray-400">
                Contoh kalimat belum tersedia
              </div>
            ) : null}

            {/* S9-05 (AC-SRS-07, BR-SRS-07): Pattern Drill hanya SEKALI per ablaut_class baru */}
            {isVerb && shouldShowPatternDrill(word.ablaut_class, seenAblautClasses) && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg text-left text-xs text-amber-900 dark:text-amber-300">
                💡 **Pattern Drill (Ablaut)**: Kata kerja ini mengikuti pola perubahan kelas **{word.ablaut_class}**.
              </div>
            )}
          </div>
        )
      }
    }
  };

  return (
    <div className="max-w-xl mx-auto my-6 px-4">
      {/* Progress header */}
      <div className="flex justify-between items-center text-xs text-gray-400 mb-4">
        <span>Sesi Belajar Deck</span>
        <span>Kartu {currentIndex + 1} dari {queue.length}</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-6">
        <div
          className="bg-indigo-600 h-2 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
        ></div>
      </div>

      {/* Flashcard container */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-md min-h-[300px] flex flex-col justify-between p-8 mb-6 relative">
        {/* Top right actions */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleSuspend}
            className="text-xs font-semibold text-gray-400 hover:text-red-500 transition min-h-[44px] px-2 flex items-center"
            title="Tangguhkan kartu ini"
          >
            [ Tangguhkan ]
          </button>

          <button
            onClick={() => handlePlayAudio(word.lemma)}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-indigo-600 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Dengarkan pengucapan"
            aria-label="Putar pengucapan"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </button>
        </div>

        {/* Card Face */}
        <div className="flex-1 flex flex-col justify-center my-6">
          {!showAnswer ? getQuestion() : getAnswer()}
        </div>

        {/* Action button / Rating buttons */}
        <div className="mt-8">
          {!showAnswer ? (
            <button
              onClick={() => {
                setShowAnswer(true)
                handlePlayAudio(word.lemma)
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-[48px] rounded-xl transition shadow-sm text-sm"
            >
              Tampilkan Jawaban (Spasi)
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleRating(1)}
                className="bg-red-50 dark:bg-red-950/20 hover:bg-red-500 hover:text-white text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 h-[48px] rounded-xl text-xs font-bold transition flex flex-col justify-center items-center"
              >
                Lagi (1)
                <span className="block font-normal text-[9px] opacity-70">1h</span>
              </button>
              <button
                onClick={() => handleRating(2)}
                className="bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-500 hover:text-white text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 h-[48px] rounded-xl text-xs font-bold transition flex flex-col justify-center items-center"
              >
                Keras (2)
                <span className="block font-normal text-[9px] opacity-70">1d</span>
              </button>
              <button
                onClick={() => handleRating(3)}
                className="bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-650 hover:text-white text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 h-[48px] rounded-xl text-xs font-bold transition flex flex-col justify-center items-center"
              >
                Baik (3)
                <span className="block font-normal text-[9px] opacity-70">4d</span>
              </button>
              <button
                onClick={() => handleRating(4)}
                className="bg-green-50 dark:bg-green-950/20 hover:bg-green-600 hover:text-white text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50 h-[48px] rounded-xl text-xs font-bold transition flex flex-col justify-center items-center"
              >
                Mudah (4)
                <span className="block font-normal text-[9px] opacity-70">8d</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default ReviewSession
