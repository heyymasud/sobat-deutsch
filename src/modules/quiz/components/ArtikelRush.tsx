import React, { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Zap, Timer, Flame, RotateCcw, Check, X, Plus, Lightbulb } from 'lucide-react'
import { db } from '../../../core/db/dictionaryDb'
import type { MistakeTrackerEntry } from '../../../core/db/dictionaryDb'
import { generateCardsForWord } from '../../../core/srs/srsScheduler'
import type { DictionaryEntry } from '../../dictionary/types'
import { syncEngine } from '../../../core/sync/syncEngine'
import { getGenderClue } from '../../dictionary/utils/genderClue'
import { GenderTipsModal } from '../../dictionary/components/GenderTipsModal'
import { Modal } from '../../../components/Modal'

// FR-QUIZ-12: bias word selection toward a user-picked difficulty tier.
// Additive to the existing mistake-count weight (S5-02), not a replacement --
// and always a WEIGHT (probability skew), never a hard filter, so a word pool
// is never empty just because the current batch lacks that tier (EC-QUIZ-06).
export type ArtikelRushDifficulty = 'easy' | 'normal' | 'hard'

const TIER_WEIGHT_BY_DIFFICULTY: Record<ArtikelRushDifficulty, Record<string, number>> = {
  easy: { A1: 6, A2: 3, B1: 1, none: 1 },
  normal: { A1: 3, A2: 2, B1: 1, none: 1 },
  hard: { A1: 1, A2: 1, B1: 3, none: 4 },
}

const frequencyTierWeight = (level: string | null, difficulty: ArtikelRushDifficulty): number => {
  const table = TIER_WEIGHT_BY_DIFFICULTY[difficulty]
  return table[level ?? 'none'] ?? 1
}

interface RecommendedWord extends MistakeTrackerEntry {
  word?: DictionaryEntry
}

export const ArtikelRush: React.FC = () => {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'ended'>('idle')
  const [difficulty, setDifficulty] = useState<ArtikelRushDifficulty>('normal')
  const [showGenderTips, setShowGenderTips] = useState(false)
  const [currentWord, setCurrentWord] = useState<DictionaryEntry | null>(null)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(30)
  const [highScore, setHighScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [highStreak, setHighStreak] = useState(0)
  const [totalAnswered, setTotalAnswered] = useState(0)
  const [correctAnswered, setCorrectAnswered] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [lastSelected, setLastSelected] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Recommendations state
  const [recommendations, setRecommendations] = useState<RecommendedWord[]>([])
  const [decks, setDecks] = useState<any[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState<string>('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [wordToAddToDeck, setWordToAddToDeck] = useState<DictionaryEntry | null>(null)
  const [bulkAddMode, setBulkAddMode] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Hoistable helper function declarations
  async function loadDecks() {
    const list = await db.decks.toArray()
    setDecks(list)
    if (list.length > 0) {
      setSelectedDeckId(list[0].id!.toString())
    }
  }

  async function loadRecommendations() {
    try {
      const list = await db.mistakeTracker
        .orderBy('mistakeCount')
        .reverse()
        .limit(5)
        .toArray()

      const listWithWords = await Promise.all(
        list.map(async (item) => {
          const word = await db.dictionary.where('lemma').equals(item.wordRef).first()
          return { ...item, word }
        })
      )
      setRecommendations(listWithWords.filter((i) => i.word))
    } catch (err) {
      console.error('Failed to load grammar recommendations:', err)
    }
  }

  async function handleStartGame() {
    setScore(0)
    setStreak(0)
    setHighStreak(0)
    setTotalAnswered(0)
    setCorrectAnswered(0)
    setTimeLeft(30)
    setFeedback(null)
    setLastSelected(null)
    setErrorMsg('')
    setGameState('playing')
    await fetchNextWord()
  }

  function handleEndGame() {
    setGameState('ended')
    if (timerRef.current) clearInterval(timerRef.current)

    // Save high score if beaten
    if (score > highScore) {
      setHighScore(score)
      localStorage.setItem('artikel_rush_highscore', score.toString())
    }
    loadRecommendations()
  }

  async function fetchNextWord() {
    setFeedback(null)
    setLastSelected(null)
    try {
      const count = await db.dictionary.where('pos').equals('noun').count()
      if (count === 0) {
        throw new Error('Kamus offline belum diunduh. Silakan unduh kamus terlebih dahulu di tab Kamus.')
      }

      // Fetch random nouns using random offset
      const offset = Math.floor(Math.random() * Math.max(1, count - 100))
      const candidates = await db.dictionary
        .where('pos')
        .equals('noun')
        .offset(offset)
        .limit(100)
        .toArray()

      // Quality filters (S5-03)
      const filtered = candidates.filter((w) => {
        return (
          w.gender &&
          ['m', 'f', 'n'].includes(w.gender) &&
          w.translations &&
          w.frequency_rank &&
          !w.lemma.includes(' ') &&
          !w.lemma.includes('-') &&
          w.lemma.length >= 3 &&
          w.lemma.length <= 15
        )
      })

      if (filtered.length === 0) {
        await fetchNextWord()
        return
      }

      // Weighted word selection (S5-02 mistake count x FR-QUIZ-12 frequency tier):
      const pool: DictionaryEntry[] = []
      for (const w of filtered) {
        const mistakeRecord = await db.mistakeTracker.get(w.lemma)
        const mistakeWeight = mistakeRecord ? 1 + mistakeRecord.mistakeCount : 1
        const weight = mistakeWeight * frequencyTierWeight(w.level, difficulty)
        for (let idx = 0; idx < weight; idx++) {
          pool.push(w)
        }
      }

      // Select randomly from pool
      const selected = pool[Math.floor(Math.random() * pool.length)]
      setCurrentWord(selected)
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Gagal memuat kata kuis.')
      handleEndGame()
    }
  }

  function handlePlayAudio(lemma: string, gender: string | null) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const article = gender === 'm' ? 'der' : gender === 'f' ? 'die' : gender === 'n' ? 'das' : ''
      const speakText = article ? `${article} ${lemma}` : lemma
      const utterance = new SpeechSynthesisUtterance(speakText)
      utterance.lang = 'de-DE'
      window.speechSynthesis.speak(utterance)
    }
  }

  async function handleAnswer(selectedGender: 'm' | 'f' | 'n') {
    if (!currentWord || feedback) return

    setLastSelected(selectedGender)
    const isCorrect = currentWord.gender === selectedGender
    setTotalAnswered((prev) => prev + 1)

    if (isCorrect) {
      setFeedback('correct')
      setScore((prev) => prev + 10)
      setCorrectAnswered((prev) => prev + 1)
      setStreak((prev) => {
        const next = prev + 1
        setHighStreak((prevHigh) => Math.max(prevHigh, next))
        return next
      })
      handlePlayAudio(currentWord.lemma, currentWord.gender)

      setTimeout(() => {
        fetchNextWord()
      }, 700)
    } else {
      setFeedback('incorrect')
      setStreak(0)
      handlePlayAudio(currentWord.lemma, currentWord.gender)
      try {
        const existing = await db.mistakeTracker.get(currentWord.lemma)
        const updated = existing
          ? { ...existing, mistakeCount: existing.mistakeCount + 1, lastMistakeAt: Date.now() }
          : { wordRef: currentWord.lemma, mistakeCount: 1, recommendedToDeck: false, lastMistakeAt: Date.now() }

        if (existing) {
          await db.mistakeTracker.update(currentWord.lemma, updated)
        } else {
          await db.mistakeTracker.add(updated)
        }
        await db.syncQueue.add({
          action: 'update',
          entityTable: 'mistakeTracker',
          entityData: updated,
          queuedAt: Date.now(),
        })
        syncEngine.triggerSync()
      } catch (err) {
        console.error('Failed to update mistake tracker:', err)
      }

      // Give the user enough time to actually read the gender-clue hint
      // (FR-QUIZ-13) before the card auto-advances -- 1000ms was tuned for
      // the plain "Salah! Jawaban: ..." line and disappeared before the hint
      // below it could be read.
      const hasHint = !!getGenderClue(currentWord.lemma, true)
      setTimeout(() => {
        fetchNextWord()
      }, hasHint ? 3400 : 1000)
    }
  }

  function triggerAddToDeck(word: DictionaryEntry) {
    setWordToAddToDeck(word)
    setBulkAddMode(false)
    setShowAddModal(true)
  }

  function triggerAddAllToDeck() {
    setWordToAddToDeck(null)
    setBulkAddMode(true)
    setShowAddModal(true)
  }

  async function confirmAddAllToDeck() {
    if (!selectedDeckId) return
    const wordsToAdd = recommendations.filter((r) => !r.recommendedToDeck).map((r) => r.word!)
    if (wordsToAdd.length === 0) {
      setShowAddModal(false)
      setBulkAddMode(false)
      return
    }

    try {
      const deckId = parseInt(selectedDeckId, 10)
      let addedCount = 0

      // Single transaction for atomicity across all words (S9-08).
      await db.transaction('rw', [db.srsCards, db.syncQueue, db.mistakeTracker], async () => {
        for (const word of wordsToAdd) {
          const existing = await db.srsCards
            .where('deckId')
            .equals(deckId)
            .and((c) => c.wordRef === word.lemma)
            .first()

          if (existing) continue // duplicate-prevention, same rule as single add

          const cards = generateCardsForWord(word, deckId)
          for (const card of cards) {
            const cardId = await db.srsCards.add(card as any)
            await db.syncQueue.add({
              action: 'insert',
              entityTable: 'srsCards',
              entityData: { id: cardId, ...card },
              queuedAt: Date.now(),
            })
          }
          await db.mistakeTracker.update(word.lemma, { recommendedToDeck: true })
          const updatedMistake = await db.mistakeTracker.get(word.lemma)
          if (updatedMistake) {
            await db.syncQueue.add({
              action: 'update',
              entityTable: 'mistakeTracker',
              entityData: updatedMistake,
              queuedAt: Date.now(),
            })
          }
          addedCount++
        }
      })
      syncEngine.triggerSync()

      alert(`Berhasil menambahkan ${addedCount} kata ke deck belajar!`)
      setShowAddModal(false)
      setBulkAddMode(false)
      loadRecommendations()
    } catch (err) {
      console.error(err)
      alert('Gagal menambahkan ke deck.')
    }
  }

  async function confirmAddToDeck() {
    if (!wordToAddToDeck || !selectedDeckId) return

    try {
      const deckId = parseInt(selectedDeckId, 10)

      const existing = await db.srsCards
        .where('deckId')
        .equals(deckId)
        .and((c) => c.wordRef === wordToAddToDeck.lemma)
        .first()

      if (existing) {
        alert('Kata ini sudah ada di deck Anda!')
        return
      }

      const cards = generateCardsForWord(wordToAddToDeck, deckId)

      await db.transaction('rw', [db.srsCards, db.syncQueue, db.mistakeTracker], async () => {
        for (const card of cards) {
          const cardId = await db.srsCards.add(card as any)
          await db.syncQueue.add({
            action: 'insert',
            entityTable: 'srsCards',
            entityData: { id: cardId, ...card },
            queuedAt: Date.now(),
          })
        }
        await db.mistakeTracker.update(wordToAddToDeck.lemma, { recommendedToDeck: true })
        const updatedMistake = await db.mistakeTracker.get(wordToAddToDeck.lemma)
        if (updatedMistake) {
          await db.syncQueue.add({
            action: 'update',
            entityTable: 'mistakeTracker',
            entityData: updatedMistake,
            queuedAt: Date.now(),
          })
        }
      })
      syncEngine.triggerSync()

      alert('Berhasil ditambahkan ke deck belajar!')
      setShowAddModal(false)
      setWordToAddToDeck(null)
      loadRecommendations()
    } catch (err) {
      console.error(err)
      alert('Gagal menambahkan ke deck.')
    }
  }

  // Effects at bottom
  useEffect(() => {
    // Load high score
    const savedHighScore = localStorage.getItem('artikel_rush_highscore')
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10))
    }
    loadRecommendations()
    loadDecks()
  }, [])

  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleEndGame()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameState, score, highScore]) // include timer deps

  const genderButton = (gender: 'm' | 'f' | 'n', article: string) => {
    const isRightAnswer = feedback && currentWord?.gender === gender
    const isWrongPick = lastSelected === gender && feedback === 'incorrect'
    let cls = 'relative h-24 rounded-2xl font-display text-2xl font-black transition-transform active:scale-95'

    if (isRightAnswer) {
      cls += ' bg-success text-white'
    } else if (isWrongPick) {
      cls += ' bg-danger text-white'
    } else {
      cls += ` bg-gender-${gender} text-white`
    }
    if (feedback && !isRightAnswer && !isWrongPick) cls += ' opacity-40'

    return (
      <button onClick={() => handleAnswer(gender)} disabled={!!feedback} className={cls}>
        {article}
      </button>
    )
  }

  return (
    <div className="max-w-5xl mx-auto text-left grid md:grid-cols-3 gap-6">
      {/* Quiz Area */}
      <div className="md:col-span-2 flex flex-col items-center gap-4">
        <div className="card p-6 md:p-10 w-full min-h-96 flex flex-col justify-between text-center">
          {gameState === 'idle' && (
            <div className="my-auto">
              <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gender-p text-ink mb-6">
                <Zap className="h-9 w-9" fill="currentColor" />
              </motion.div>
              <h2 className="page-title text-3xl md:text-4xl mb-3">Artikel Rush</h2>
              <p className="text-ink-muted mb-6 max-w-sm mx-auto">
                Tebak der / die / das secepat mungkin. Makin cepat & panjang streak, makin tinggi skor.
              </p>
              <div className="flex items-center justify-center gap-6 text-sm text-ink-faint mb-6">
                <span className="flex items-center gap-2"><Timer className="h-4 w-4" /> 30 detik</span>
                {highScore > 0 && (
                  <span className="flex items-center gap-2"><Flame className="h-4 w-4 text-gender-p" /> skor tertinggi: {highScore}</span>
                )}
              </div>

              {/* FR-QUIZ-12: user-picked difficulty, biases word selection (weight, not a hard filter) */}
              <div className="flex items-center justify-center gap-1.5 mb-8" role="radiogroup" aria-label="Tingkat kesulitan">
                {([
                  { value: 'easy', label: 'Gampang' },
                  { value: 'normal', label: 'Biasa' },
                  { value: 'hard', label: 'Susah' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    role="radio"
                    aria-checked={difficulty === opt.value}
                    onClick={() => setDifficulty(opt.value)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                      difficulty === opt.value ? 'bg-brand text-white' : 'bg-surface-muted text-ink-muted hover:text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button onClick={handleStartGame} className="btn-primary !px-8 !py-3.5 text-base">Mulai Bermain</button>

              <div className="mt-6">
                <button
                  onClick={() => setShowGenderTips(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline transition-colors bg-brand-soft px-3 py-1.5 rounded-full"
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  Lihat semua tips pola gender
                </button>
              </div>
            </div>
          )}
          {showGenderTips && <GenderTipsModal onClose={() => setShowGenderTips(false)} />}

          {gameState === 'playing' && currentWord && (
            <>
              {/* Score, streak & timer */}
              <div className="flex items-center justify-between mb-4">
                <span className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-bold text-sm ${streak > 0 ? 'bg-gender-p text-ink' : 'bg-surface-muted text-ink-muted'}`}>
                  <Flame className="h-4 w-4" /> {streak}
                </span>
                <span className="stat-figure text-2xl">{score}</span>
                <span className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-bold text-sm ${timeLeft <= 10 ? 'bg-danger text-white' : 'bg-surface-muted text-ink-muted'}`}>
                  <Timer className="h-4 w-4" /> {timeLeft}s
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted mb-2">
                <div className="h-full bg-gender-p transition-[width] duration-1000 ease-linear" style={{ width: `${(timeLeft / 30) * 100}%` }} />
              </div>

              {/* Word Display */}
              <AnimatePresence mode="wait">
                <motion.div key={currentWord.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.2 }} className="my-auto flex flex-col items-center justify-center">
                  <h3 className="page-title text-4xl md:text-5xl mb-2">
                    {currentWord.lemma.charAt(0).toUpperCase() + currentWord.lemma.slice(1)}
                  </h3>
                  <p className="text-sm text-ink-faint max-w-xs">{currentWord.translations}</p>
                </motion.div>
              </AnimatePresence>

              {/* Status Indicator */}
              <div className="mb-4">
                {feedback === 'correct' && (
                  <span className="flex items-center justify-center gap-1.5 font-display font-bold text-sm text-success h-6">
                    <Check className="h-4 w-4" /> Benar (+10)
                  </span>
                )}
                {feedback === 'incorrect' && (
                  <>
                    <span className="flex items-center justify-center gap-1.5 font-display font-bold text-sm text-danger h-6">
                      <X className="h-4 w-4" /> Salah! Jawaban: {currentWord.gender === 'm' ? 'der' : currentWord.gender === 'f' ? 'die' : 'das'}
                    </span>
                    {/* FR-QUIZ-13/BR-QUIZ-07: reuse the same rule as WordDetail's
                        "Petunjuk Pola" -- only shown when it actually matches. */}
                    {getGenderClue(currentWord.lemma, true) && (
                      <p className="text-xs text-ink-faint text-center mt-1">
                        💡 {getGenderClue(currentWord.lemma, true)!.rule} (mis. {getGenderClue(currentWord.lemma, true)!.example})
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {genderButton('m', 'der')}
                {genderButton('f', 'die')}
                {genderButton('n', 'das')}
              </div>
            </>
          )}

          {gameState === 'ended' && (
            <div className="my-auto">
              <h2 className="page-title text-3xl mb-6">Waktu Habis!</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="card p-6">
                  <p className="eyebrow">Skor</p>
                  <p className="stat-figure text-5xl mt-1">{score}</p>
                </div>
                <div className="card p-6">
                  <p className="eyebrow">Terbaik</p>
                  <p className="stat-figure text-5xl mt-1 text-gender-p">{Math.max(highScore, score)}</p>
                </div>
              </div>
              <p className="text-sm text-ink-muted mb-1">
                Akurasi: <strong className="text-ink">{totalAnswered > 0 ? Math.round((correctAnswered / totalAnswered) * 100) : 0}%</strong>
              </p>
              <p className="text-sm text-ink-muted mb-6">
                Streak Tertinggi: <strong className="text-ink">{highStreak}</strong>
              </p>
              <button onClick={handleStartGame} className="btn-primary !px-8 !py-3.5 text-base inline-flex items-center gap-2">
                <RotateCcw className="h-4 w-4" /> Main Lagi
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl border text-sm w-full text-danger bg-danger-soft border-danger">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Recommendations Panel */}
      <div className="card p-6 h-fit">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-display font-bold text-ink text-sm uppercase tracking-wide">Perlu Diulang</h3>
          {recommendations.some((r) => !r.recommendedToDeck) && (
            <button onClick={triggerAddAllToDeck} className="badge badge-accent whitespace-nowrap">
              Tambah Semua
            </button>
          )}
        </div>
        <p className="text-xs text-ink-faint mb-4">
          Kata yang paling sering salah saat kuis. Tambahkan ke deck flashcard untuk dipelajari di SRS.
        </p>

        {recommendations.length === 0 ? (
          <div className="text-xs text-ink-faint italic text-center py-8 border border-dashed border-border rounded-2xl">
            Belum ada rekomendasi. Mainkan kuis terlebih dahulu!
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recommendations.map((item) => {
              const displayLemma = item.word!.lemma.charAt(0).toUpperCase() + item.word!.lemma.slice(1)
              const genderArticle = item.word!.gender === 'm' ? 'der' : item.word!.gender === 'f' ? 'die' : 'das'

              return (
                <div key={item.wordRef} className="flex items-center justify-between gap-2 rounded-xl bg-surface-muted px-4 py-3 text-xs">
                  <div>
                    <div className="font-display font-bold text-ink">
                      <span className="text-brand font-semibold mr-1">{genderArticle}</span>
                      {displayLemma}
                    </div>
                    <div className="text-xs font-medium text-danger">
                      Salah {item.mistakeCount} kali
                    </div>
                  </div>

                  {!item.recommendedToDeck ? (
                    <button onClick={() => triggerAddToDeck(item.word!)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-white">
                      <Plus className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="text-xs text-ink-faint italic whitespace-nowrap">Sudah di deck</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add To Deck Modal */}
      {showAddModal && (bulkAddMode || wordToAddToDeck) && (
        <Modal
          title={bulkAddMode ? 'Tambah Semua Rekomendasi' : 'Tambah Rekomendasi Kata'}
          onClose={() => {
            setShowAddModal(false)
            setWordToAddToDeck(null)
            setBulkAddMode(false)
          }}
          footer={
            <div className="flex gap-2 justify-end text-sm">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setWordToAddToDeck(null)
                  setBulkAddMode(false)
                }}
                className="btn-secondary"
              >
                Batal
              </button>
              <button
                disabled={decks.length === 0}
                onClick={bulkAddMode ? confirmAddAllToDeck : confirmAddToDeck}
                className="btn-primary"
              >
                Tambah
              </button>
            </div>
          }
        >
          <p className="text-sm text-ink-muted mb-4">
            {bulkAddMode ? (
              <>
                Pilih deck tujuan untuk mendaftarkan{' '}
                <strong className="text-ink">{recommendations.filter((r) => !r.recommendedToDeck).length} kata</strong>{' '}
                rekomendasi sekaligus.
              </>
            ) : (
              <>
                Pilih deck tujuan untuk mendaftarkan kata{' '}
                <strong className="text-ink">"{wordToAddToDeck!.lemma}"</strong>.
              </>
            )}
          </p>

          {decks.length === 0 ? (
            <div className="text-sm p-3 rounded-xl border text-center text-warning bg-warning-soft border-warning">
              Belum ada deck. Buka tab <strong>SRS</strong> untuk membuat deck terlebih dahulu.
            </div>
          ) : (
            <select className="field-input text-sm" value={selectedDeckId} onChange={(e) => setSelectedDeckId(e.target.value)}>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>{deck.name}</option>
              ))}
            </select>
          )}
        </Modal>
      )}
    </div>
  )
}
export default ArtikelRush
