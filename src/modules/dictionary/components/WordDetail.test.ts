import { describe, it, expect } from 'vitest'
import { pickAblautSiblings } from './ablautSiblings'
import type { DictionaryEntry } from '../types'

const makeEntry = (id: number, lemma: string): DictionaryEntry => ({
  id,
  lemma,
  pos: 'verb',
  gender: null,
  plural: null,
  genitiv_singular: null,
  translations: `to ${lemma}`,
  example: null,
  separable_prefix: null,
  auxiliary: 'haben',
  verb_class: 'strong',
  ablaut_class: 'i-a-u',
  case_governance: null,
  conjugation_table: null,
  comparative: null,
  superlative: null,
  level: 'A1',
  theme_tags: null,
  frequency_rank: null,
})

describe('pickAblautSiblings (AC-GRAM-03)', () => {
  it('excludes the current word itself', () => {
    const candidates = [makeEntry(1, 'singen'), makeEntry(2, 'trinken')]
    const result = pickAblautSiblings(candidates, 'singen')
    expect(result.map((r) => r.lemma)).toEqual(['trinken'])
  })

  it('caps the result at the given limit (default 5)', () => {
    const candidates = Array.from({ length: 10 }, (_, i) => makeEntry(i, `verb${i}`))
    const result = pickAblautSiblings(candidates, 'none')
    expect(result).toHaveLength(5)
  })

  it('returns empty array when no siblings found', () => {
    expect(pickAblautSiblings([], 'singen')).toEqual([])
  })
})
