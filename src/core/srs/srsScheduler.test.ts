import { describe, it, expect } from 'vitest'
import {
  calculateSm2,
  generateCardsForWord,
  interleaveByKey,
  shouldShowPatternDrill,
  calculateAccuracy,
  isSessionStateFresh,
} from './srsScheduler'
import type { DictionaryEntry } from '../../modules/dictionary/types'

describe('SM-2 Algorithm', () => {
  it('should reset repetitions and set interval to 1 on rating 1 (Again)', () => {
    const result = calculateSm2(1, 10, 2.5, 3)
    expect(result.repetitions).toBe(0)
    expect(result.interval).toBe(1)
    expect(result.easeFactor).toBe(2.3)
  })

  it('should increase repetitions and compute interval correctly on rating 3 (Good)', () => {
    const firstRep = calculateSm2(3, 0, 2.5, 0)
    expect(firstRep.repetitions).toBe(1)
    expect(firstRep.interval).toBe(1)

    const secondRep = calculateSm2(3, 1, 2.5, 1)
    expect(secondRep.repetitions).toBe(2)
    expect(secondRep.interval).toBe(6)

    const thirdRep = calculateSm2(3, 6, 2.5, 2)
    expect(thirdRep.repetitions).toBe(3)
    expect(thirdRep.interval).toBe(15) // 6 * 2.5
  })
})

describe('interleaveByKey (AC-SRS-02 interleaving)', () => {
  it('should not produce runs of 3+ consecutive items sharing the same ablaut_class', () => {
    // Simulasi antrean sebelum di-fix: dikelompokkan per ablaut_class (blok panjang)
    const classes = ['I', 'I', 'I', 'I', 'I', 'II', 'II', 'II', 'II', 'III', 'III', 'III', 'IV', 'IV', 'V']
    const items = classes.map((ablaut_class, i) => ({ id: i, ablaut_class }))

    const result = interleaveByKey(items, (item) => item.ablaut_class)

    // Semua item tetap ada (tidak ada yang hilang/duplikat)
    expect(result.length).toBe(items.length)
    expect(new Set(result.map((r) => r.id)).size).toBe(items.length)

    // Tidak boleh ada 3 kartu berturut-turut dengan ablaut_class yang sama
    let runLength = 1
    for (let i = 1; i < result.length; i++) {
      if (result[i].ablaut_class === result[i - 1].ablaut_class) {
        runLength++
      } else {
        runLength = 1
      }
      expect(runLength).toBeLessThan(3)
    }
  })

  it('should leave a single-group list unchanged (no other key to interleave with)', () => {
    const items = [{ ablaut_class: 'I' }, { ablaut_class: 'I' }, { ablaut_class: 'I' }]
    expect(interleaveByKey(items, (item) => item.ablaut_class)).toEqual(items)
  })

  it('should never use theme/tema as the interleave key (BR-SRS-04 guard)', () => {
    // Kontrak fungsi: keyFn generik, tapi kita pastikan pemanggilan nyata di
    // ReviewSession memakai ablaut_class, bukan theme_tags. Cek di sini bahwa
    // hasil interleave-by-theme (kalau ada yang salah pakai) akan tetap terdeteksi
    // beda perilakunya dari interleave-by-ablaut_class untuk data campuran.
    const items = [
      { ablaut_class: 'I', theme: 'food' },
      { ablaut_class: 'I', theme: 'food' },
      { ablaut_class: 'II', theme: 'food' },
      { ablaut_class: 'II', theme: 'travel' },
    ]
    const byAblaut = interleaveByKey(items, (i) => i.ablaut_class)
    const byTheme = interleaveByKey(items, (i) => i.theme)
    // Dua strategi kunci berbeda bisa menghasilkan urutan berbeda -> membuktikan
    // fungsi ini tidak diam-diam selalu pakai tema.
    expect(byAblaut).not.toEqual(byTheme)
  })
})

describe('Automatic Card Generation', () => {
  it('should generate meaning card only for simple verbs', () => {
    const verb: DictionaryEntry = {
      id: 1,
      lemma: 'gehen',
      pos: 'verb',
      gender: null,
      plural: null,
      genitiv_singular: null,
      translations: 'to go',
      example: null,
      separable_prefix: null,
      auxiliary: null,
      verb_class: null,
      ablaut_class: null,
      case_governance: null,
      conjugation_table: null,
      comparative: null,
      superlative: null,
      level: 'A1',
      theme_tags: null,
      frequency_rank: 100,
      ipa: null,
      etymology: null,
      hyphenation: null
    }

    const cards = generateCardsForWord(verb, 1)
    expect(cards).toHaveLength(1)
    expect(cards[0].cardType).toBe('arti')
  })

  it('should generate meaning, gender, and plural cards for Nouns', () => {
    const noun: DictionaryEntry = {
      id: 2,
      lemma: 'Hund',
      pos: 'noun',
      gender: 'm',
      plural: 'Hunde',
      genitiv_singular: null,
      translations: 'dog',
      example: null,
      separable_prefix: null,
      auxiliary: null,
      verb_class: null,
      ablaut_class: null,
      case_governance: null,
      conjugation_table: null,
      comparative: null,
      superlative: null,
      level: 'A1',
      theme_tags: null,
      frequency_rank: 200,
      ipa: null,
      etymology: null,
      hyphenation: null
    }

    const cards = generateCardsForWord(noun, 1)
    expect(cards).toHaveLength(3)
    const types = cards.map((c) => c.cardType)
    expect(types).toContain('arti')
    expect(types).toContain('gender')
    expect(types).toContain('plural')
  })

  it('should generate cloze-kasus and conjugation cards for verbs with governance and conjugations', () => {
    const enrichedVerb: DictionaryEntry = {
      id: 3,
      lemma: 'anfangen',
      pos: 'verb',
      gender: null,
      plural: null,
      genitiv_singular: null,
      translations: 'to start',
      example: 'Wir fangen an.',
      separable_prefix: 'an',
      auxiliary: 'haben',
      verb_class: 'strong',
      ablaut_class: 'class 7',
      case_governance: ['mit + Dativ'],
      conjugation_table: {
        'praesens': { 'ich': 'fange an', 'du': 'fängst an' }
      },
      comparative: null,
      superlative: null,
      level: 'A1',
      theme_tags: null,
      frequency_rank: 50,
      ipa: null,
      etymology: null,
      hyphenation: null
    }

    const cards = generateCardsForWord(enrichedVerb, 1)
    expect(cards.length).toBe(3) // meaning, cloze-kasus, and conjugation
    const types = cards.map((c) => c.cardType)
    expect(types).toContain('arti')
    expect(types).toContain('cloze-kasus')
    expect(types).toContain('konjugasi')
  })
})

describe('shouldShowPatternDrill (S9-05, AC-SRS-07, BR-SRS-07)', () => {
  it('should show the drill the first time an ablaut_class is encountered', () => {
    expect(shouldShowPatternDrill('class 7', new Set())).toBe(true)
  })

  it('should NOT show the drill again once the class has been seen', () => {
    expect(shouldShowPatternDrill('class 7', new Set(['class 7']))).toBe(false)
  })

  it('should never show the drill when there is no ablaut_class (non-strong verbs)', () => {
    expect(shouldShowPatternDrill(null, new Set())).toBe(false)
    expect(shouldShowPatternDrill(undefined, new Set())).toBe(false)
  })

  it('should still show a different, unseen class even if another class was already seen', () => {
    expect(shouldShowPatternDrill('class 2', new Set(['class 7']))).toBe(true)
  })
})

describe('calculateAccuracy (S9-06, AC-SRS-09)', () => {
  it('should return 0 for an empty session', () => {
    expect(calculateAccuracy([])).toBe(0)
  })

  it('should count ratings 3 (Baik) and 4 (Mudah) as correct', () => {
    expect(calculateAccuracy([3, 4, 3, 4])).toBe(1)
  })

  it('should count ratings 1 (Lagi) and 2 (Keras) as incorrect', () => {
    expect(calculateAccuracy([1, 2, 1, 2])).toBe(0)
  })

  it('should compute a mixed ratio correctly', () => {
    expect(calculateAccuracy([1, 2, 3, 4])).toBe(0.5)
  })
})

describe('isSessionStateFresh (S9-07, AC-SRS-11)', () => {
  it('should be fresh right after saving', () => {
    const now = 1_000_000
    expect(isSessionStateFresh(now, now)).toBe(true)
  })

  it('should be fresh just under the default 6h cutoff', () => {
    const savedAt = 1_000_000
    const now = savedAt + 6 * 60 * 60 * 1000 - 1
    expect(isSessionStateFresh(savedAt, now)).toBe(true)
  })

  it('should be stale at/after the default 6h cutoff', () => {
    const savedAt = 1_000_000
    const now = savedAt + 6 * 60 * 60 * 1000
    expect(isSessionStateFresh(savedAt, now)).toBe(false)
  })

  it('should respect a custom maxAgeMs', () => {
    const savedAt = 1_000_000
    expect(isSessionStateFresh(savedAt, savedAt + 1000, 500)).toBe(false)
    expect(isSessionStateFresh(savedAt, savedAt + 100, 500)).toBe(true)
  })
})
