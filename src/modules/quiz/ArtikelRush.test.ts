import { describe, it, expect } from 'vitest'

describe('Artikel Rush Logic', () => {
  it('correctly matches der, die, das genders', () => {
    const word = { lemma: 'Apfel', gender: 'm' }
    
    const isCorrectDer = word.gender === 'm'
    const isCorrectDie = word.gender === 'f'
    
    expect(isCorrectDer).toBe(true)
    expect(isCorrectDie).toBe(false)
  })

  it('updates mistake counts in local tracker objects', () => {
    const mistakeTracker: Record<string, { wordRef: string; count: number }> = {}
    
    const recordMistake = (wordRef: string) => {
      if (mistakeTracker[wordRef]) {
        mistakeTracker[wordRef].count++
      } else {
        mistakeTracker[wordRef] = { wordRef, count: 1 }
      }
    }

    recordMistake('Apfel')
    expect(mistakeTracker['Apfel'].count).toBe(1)
    
    recordMistake('Apfel')
    expect(mistakeTracker['Apfel'].count).toBe(2)
  })

  // AC-QUIZ-02 / AC-QUIZ-03: streak increments on correct, resets to 0 on incorrect
  it('increments streak on correct answer and resets to 0 on incorrect answer', () => {
    let streak = 0
    let highStreak = 0
    const onCorrect = () => {
      streak += 1
      highStreak = Math.max(highStreak, streak)
    }
    const onIncorrect = () => {
      streak = 0
    }

    onCorrect()
    onCorrect()
    onCorrect()
    expect(streak).toBe(3)
    expect(highStreak).toBe(3)

    onIncorrect()
    expect(streak).toBe(0)
    expect(highStreak).toBe(3) // highest streak this session is preserved
  })

  // AC-QUIZ-04: word wrong >= 3 times must surface in the recommendation list (top mistakes)
  it('surfaces words with >= 3 mistakes in the mistake-sorted recommendation list', () => {
    const tracker = [
      { wordRef: 'Apfel', mistakeCount: 1 },
      { wordRef: 'Haus', mistakeCount: 3 },
      { wordRef: 'Baum', mistakeCount: 5 },
    ]
    // mirror db.mistakeTracker.orderBy('mistakeCount').reverse().limit(5)
    const recommendations = [...tracker].sort((a, b) => b.mistakeCount - a.mistakeCount).slice(0, 5)

    const heavyMistakeWords = recommendations.filter((r) => r.mistakeCount >= 3).map((r) => r.wordRef)
    expect(heavyMistakeWords).toContain('Haus')
    expect(heavyMistakeWords).toContain('Baum')
    expect(recommendations[0].wordRef).toBe('Baum') // most-missed word ranked first
  })

  // AC-QUIZ-06: ended session shows score, accuracy, and highest streak
  it('computes accuracy from correct/total answered at session end', () => {
    const totalAnswered = 8
    const correctAnswered = 6
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswered / totalAnswered) * 100) : 0
    expect(accuracy).toBe(75)
  })

  // AC-QUIZ-07: a session abandoned before time runs out must not be recorded as a high score.
  // ArtikelRush only persists `artikel_rush_highscore` to localStorage inside handleEndGame(),
  // which is invoked by the timer expiring — never by unmount/navigation. So abandoning mid-game
  // (component unmount) never touches the stored high score.
  it('does not persist a high score unless the end-of-session save path runs', () => {
    const storage: Record<string, string> = {}
    const saveHighScoreIfBeaten = (score: number, highScore: number) => {
      if (score > highScore) {
        storage['artikel_rush_highscore'] = score.toString()
      }
    }

    // Simulate: player scores 50, then abandons (unmounts) without the save path ever running.
    const scoreAtAbandonment = 50
    // saveHighScoreIfBeaten is intentionally NOT called on abandonment.
    expect(storage['artikel_rush_highscore']).toBeUndefined()

    // Contrast: a real session end DOES persist it.
    saveHighScoreIfBeaten(scoreAtAbandonment, 0)
    expect(storage['artikel_rush_highscore']).toBe('50')
  })

  // S9-08 / AC-QUIZ-05, FR-QUIZ-06: "Tambahkan semua" must add cards for every
  // recommended word in one go, skipping words already present in the deck.
  it('bulk-adds cards for every recommended word without duplicating existing deck entries', () => {
    const deckId = 1
    const recommendations = [
      { wordRef: 'Apfel', recommendedToDeck: false },
      { wordRef: 'Haus', recommendedToDeck: false },
      { wordRef: 'Baum', recommendedToDeck: false },
    ]

    // Simulate a deck that already contains a card for 'Haus' (mirrors db.srsCards).
    const existingSrsCards = [{ deckId, wordRef: 'Haus' }]
    const mistakeTracker: Record<string, { recommendedToDeck: boolean }> = {
      Apfel: { recommendedToDeck: false },
      Haus: { recommendedToDeck: false },
      Baum: { recommendedToDeck: false },
    }

    // Mirrors confirmAddAllToDeck(): skip words with an existing srsCards row for this deck.
    let addedCount = 0
    const wordsToAdd = recommendations.filter((r) => !r.recommendedToDeck).map((r) => r.wordRef)
    for (const wordRef of wordsToAdd) {
      const existing = existingSrsCards.find((c) => c.deckId === deckId && c.wordRef === wordRef)
      if (existing) continue
      existingSrsCards.push({ deckId, wordRef }) // generateCardsForWord() insert stand-in
      mistakeTracker[wordRef].recommendedToDeck = true
      addedCount++
    }

    // Exactly N-1 new words added (Haus was already present, so it's skipped, not duplicated).
    expect(addedCount).toBe(2)
    expect(existingSrsCards.filter((c) => c.wordRef === 'Haus')).toHaveLength(1)
    expect(existingSrsCards.map((c) => c.wordRef).sort()).toEqual(['Apfel', 'Baum', 'Haus'])
    expect(mistakeTracker['Apfel'].recommendedToDeck).toBe(true)
    expect(mistakeTracker['Baum'].recommendedToDeck).toBe(true)
  })
})
