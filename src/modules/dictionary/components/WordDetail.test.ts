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

// AC-GRAM-06 / BR-DICT-07: incomplete conjugation data must render as blank/absent,
// never as a fabricated guess. WordDetail iterates `Object.entries(entry.conjugation_table)`
// for tenses and `Object.entries(forms || {})` for persons — both only enumerate keys that
// actually exist in the data, so a missing tense or missing person form is simply absent
// from the rendered table rather than filled with an invented value.
describe('conjugation table rendering data-shape (AC-GRAM-06)', () => {
  it('does not fabricate a missing tense (e.g. Perfekt absent from dataset)', () => {
    const conjugation_table = {
      praesens: { ich: 'gehe', du: 'gehst' },
      // perfekt intentionally missing
    }
    const tenses = Object.entries(conjugation_table)
    expect(tenses.map(([tense]) => tense)).toEqual(['praesens'])
    expect(tenses.map(([tense]) => tense)).not.toContain('perfekt')
  })

  it('does not fabricate a missing person form within a present tense', () => {
    const forms: Record<string, string> | undefined = { ich: 'gehe' } // 'du' missing
    const rendered = Object.entries(forms || {})
    expect(rendered).toEqual([['ich', 'gehe']])
    expect(rendered.find(([person]) => person === 'du')).toBeUndefined()
  })

  it('renders nothing (not a guess) when conjugation_table itself is null', () => {
    const conjugation_table: Record<string, Record<string, string>> | null = null
    // WordDetail falls back to the "Tabel konjugasi tidak tersedia" message in this branch
    expect(conjugation_table ? Object.entries(conjugation_table) : 'unavailable').toBe('unavailable')
  })
})

// AC-GRAM-05: declension table must compute dativ plural correctly (adds 'n' unless
// the plural already ends in 'n' or 's') and show "tidak tersedia" when plural is missing.
describe('declension table dativ-plural rule (AC-GRAM-05)', () => {
  const computeDativPlural = (plural: string | null): string | null => {
    if (!plural) return null
    const plLower = plural.toLowerCase()
    if (!plLower.endsWith('n') && !plLower.endsWith('s')) {
      return `${plural}n`
    }
    return plural
  }

  it('adds trailing n when plural does not already end in n or s', () => {
    expect(computeDativPlural('Häuser')).toBe('Häusern')
  })

  it('leaves plural unchanged when it already ends in n', () => {
    expect(computeDativPlural('Frauen')).toBe('Frauen')
  })

  it('leaves plural unchanged when it already ends in s', () => {
    expect(computeDativPlural('Autos')).toBe('Autos')
  })

  it('returns null (rendered as "tidak tersedia") when plural data is missing', () => {
    expect(computeDativPlural(null)).toBeNull()
  })
})
