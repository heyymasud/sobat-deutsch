import { describe, it, expect } from 'vitest'
import { topMistakes } from './mistakeStats'
import type { MistakeTrackerEntry } from '../../../core/db/dictionaryDb'

const entry = (wordRef: string, mistakeCount: number): MistakeTrackerEntry => ({
  wordRef,
  mistakeCount,
  recommendedToDeck: false,
  lastMistakeAt: 0,
})

describe('topMistakes (FR-STAT-03)', () => {
  it('sorts descending by mistake count', () => {
    const result = topMistakes([entry('a', 2), entry('b', 5), entry('c', 1)])
    expect(result.map((r) => r.wordRef)).toEqual(['b', 'a', 'c'])
  })

  it('caps the result at the given limit (default 10)', () => {
    const entries = Array.from({ length: 15 }, (_, i) => entry(`w${i}`, i))
    expect(topMistakes(entries)).toHaveLength(10)
  })

  it('returns empty array when there are no mistakes', () => {
    expect(topMistakes([])).toEqual([])
  })
})
