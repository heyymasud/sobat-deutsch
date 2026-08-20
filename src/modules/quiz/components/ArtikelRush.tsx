import React, { useState, useEffect, useRef } from 'react'
import { db } from '../../../core/db/dictionaryDb'
import type { MistakeTrackerEntry } from '../../../core/db/dictionaryDb'
import { generateCardsForWord } from '../../../core/srs/srsScheduler'
import type { DictionaryEntry } from '../../dictionary/types'

interface RecommendedWord extends MistakeTrackerEntry {
  word?: DictionaryEntry
}

export const ArtikelRush: React.FC = () => {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'ended'>('idle')
  const [currentWord, setCurrentWord] = useState<DictionaryEntry | null>(null)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(30)
  const [highScore, setHighScore] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
  const [lastSelected, setLastSelected] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Recommendations state
  const [recommendations, setRecommendations] = useState<RecommendedWord[]>([])
  const [decks, setDecks] = useState<any[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState<string>('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [wordToAddToDeck, setWordToAddToDeck] = useState<DictionaryEntry | null>(null)

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

      // Weighted word selection (S5-02):
      const pool: DictionaryEntry[] = []
      for (const w of filtered) {
        const mistakeRecord = await db.mistakeTracker.get(w.lemma)
        const weight = mistakeRecord ? 1 + mistakeRecord.mistakeCount : 1
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

    if (isCorrect) {
      setFeedback('correct')
      setScore((prev) => prev + 10)
      handlePlayAudio(currentWord.lemma, currentWord.gender)
      
      setTimeout(() => {
        fetchNextWord()
      }, 700)
    } else {
      setFeedback('incorrect')
      handlePlayAudio(currentWord.lemma, currentWord.gender)
      try {
        const existing = await db.mistakeTracker.get(currentWord.lemma)
        if (existing) {
          await db.mistakeTracker.update(currentWord.lemma, {
            mistakeCount: existing.mistakeCount + 1,
            lastMistakeAt: Date.now(),
          })
        } else {
          await db.mistakeTracker.add({
            wordRef: currentWord.lemma,
            mistakeCount: 1,
            recommendedToDeck: false,
            lastMistakeAt: Date.now(),
          })
        }
      } catch (err) {
        console.error('Failed to update mistake tracker:', err)
      }

      setTimeout(() => {
        fetchNextWord()
      }, 1000)
    }
  }

  function triggerAddToDeck(word: DictionaryEntry) {
    setWordToAddToDeck(word)
    setShowAddModal(true)
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
      })

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

  return (
    <div className="max-w-4xl mx-auto my-6 px-4 text-left grid md:grid-cols-3 gap-8">
      {/* Quiz Area */}
      <div className="md:col-span-2 flex flex-col items-center">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-8 w-full min-h-[350px] flex flex-col justify-between text-center">
          {gameState === 'idle' && (
            <div className="my-auto">
              <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Kuis Artikel Rush</h2>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto text-sm">
                Tebak artikel gender (`der`, `die`, `das`) untuk kata benda Jerman sebanyak-banyaknya dalam waktu 30 detik!
              </p>
              <button
                onClick={handleStartGame}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition shadow-sm text-sm"
              >
                Mulai Bermain
              </button>
            </div>
          )}

          {gameState === 'playing' && currentWord && (
            <>
              {/* Header metrics */}
              <div className="flex justify-between items-center text-xs text-gray-400 mb-4">
                <span className="font-semibold text-gray-800">Skor: {score}</span>
                <span className="bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-full">
                  Waktu: {timeLeft}s
                </span>
              </div>

              {/* Word Display */}
              <div className="my-auto flex flex-col items-center justify-center">
                <h3 className="text-4xl font-extrabold text-gray-900 mb-2">
                  {currentWord.lemma.charAt(0).toUpperCase() + currentWord.lemma.slice(1)}
                </h3>
                <p className="text-sm text-gray-400 italic max-w-xs">{currentWord.translations}</p>
              </div>

              {/* Status Indicator */}
              <div className="h-6 mb-4">
                {feedback === 'correct' && (
                  <span className="text-green-600 font-bold text-sm flex items-center justify-center gap-1">
                    ✓ Benar (+10)
                  </span>
                )}
                {feedback === 'incorrect' && (
                  <span className="text-red-600 font-bold text-sm flex items-center justify-center gap-1">
                    ✗ Salah! Jawaban: {currentWord.gender === 'm' ? 'der' : currentWord.gender === 'f' ? 'die' : 'das'}
                  </span>
                )}
              </div>

              {/* Three gender buttons */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleAnswer('m')}
                  disabled={!!feedback}
                  className={`py-3.5 rounded-xl font-extrabold text-sm transition border ${
                    feedback && currentWord.gender === 'm'
                      ? 'bg-green-500 text-white border-green-500'
                      : lastSelected === 'm' && feedback === 'incorrect'
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-gender-m border-gender-m hover:bg-blue-50'
                  }`}
                >
                  der (m)
                </button>
                <button
                  onClick={() => handleAnswer('f')}
                  disabled={!!feedback}
                  className={`py-3.5 rounded-xl font-extrabold text-sm transition border ${
                    feedback && currentWord.gender === 'f'
                      ? 'bg-green-500 text-white border-green-500'
                      : lastSelected === 'f' && feedback === 'incorrect'
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-gender-f border-gender-f hover:bg-red-50'
                  }`}
                >
                  die (f)
                </button>
                <button
                  onClick={() => handleAnswer('n')}
                  disabled={!!feedback}
                  className={`py-3.5 rounded-xl font-extrabold text-sm transition border ${
                    feedback && currentWord.gender === 'n'
                      ? 'bg-green-500 text-white border-green-500'
                      : lastSelected === 'n' && feedback === 'incorrect'
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-gender-n border-gender-n hover:bg-green-50'
                  }`}
                >
                  das (n)
                </button>
              </div>
            </>
          )}

          {gameState === 'ended' && (
            <div className="my-auto">
              <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Game Over!</h2>
              <p className="text-lg text-gray-600 mb-6">Skor Anda: <strong className="text-indigo-600 text-2xl">{score}</strong></p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleStartGame}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition shadow-sm text-sm"
                >
                  Main Lagi
                </button>
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 mt-4 text-xs w-full">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Recommendations Panel */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6 h-fit">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-1.5">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Rekomendasi Belajar
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Daftar kata benda yang paling sering salah saat kuis. Tambahkan ke deck flashcard untuk dipelajari di SRS.
        </p>

        {recommendations.length === 0 ? (
          <div className="text-xs text-gray-400 italic text-center py-6 border border-dashed rounded-lg bg-gray-50">
            Belum ada rekomendasi. Mainkan kuis terlebih dahulu!
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recommendations.map((item) => {
              const displayLemma = item.word!.lemma.charAt(0).toUpperCase() + item.word!.lemma.slice(1)
              const genderArticle = item.word!.gender === 'm' ? 'der' : item.word!.gender === 'f' ? 'die' : 'das'

              return (
                <div
                  key={item.wordRef}
                  className="flex items-center justify-between border-b border-gray-150 pb-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-gray-800">
                      <span className="text-indigo-600 font-semibold mr-1">{genderArticle}</span>
                      {displayLemma}
                    </div>
                    <div className="text-[10px] text-red-500 font-medium">
                      Salah {item.mistakeCount} kali
                    </div>
                  </div>
                  
                  {!item.recommendedToDeck ? (
                    <button
                      onClick={() => triggerAddToDeck(item.word!)}
                      className="text-indigo-600 hover:text-indigo-800 font-bold hover:bg-indigo-50 border border-indigo-200 px-2 py-1 rounded transition text-[10px]"
                    >
                      + Deck
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-400 italic">Sudah di deck</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add To Deck Modal */}
      {showAddModal && wordToAddToDeck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-left border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Tambah Rekomendasi Kata</h3>
            <p className="text-sm text-gray-500 mb-4">
              Pilih deck tujuan untuk mendaftarkan kata <strong className="text-gray-800">"{wordToAddToDeck.lemma}"</strong>.
            </p>
            
            {decks.length === 0 ? (
              <div className="text-sm text-amber-600 bg-amber-50 p-3 border border-amber-100 rounded-lg mb-4 text-center">
                Belum ada deck. Buka tab <strong>SRS Flashcard</strong> untuk membuat deck terlebih dahulu.
              </div>
            ) : (
              <select
                className="w-full bg-white text-gray-950 border border-gray-300 rounded-lg p-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedDeckId}
                onChange={(e) => setSelectedDeckId(e.target.value)}
              >
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex gap-2 justify-end text-sm">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setWordToAddToDeck(null)
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-600 transition"
              >
                Batal
              </button>
              <button
                disabled={decks.length === 0}
                onClick={confirmAddToDeck}
                className={`px-4 py-2 text-white font-semibold rounded-lg transition ${
                  decks.length > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-sm'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Tambah
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default ArtikelRush
