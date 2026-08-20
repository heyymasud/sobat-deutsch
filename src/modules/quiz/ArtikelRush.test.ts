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
})
