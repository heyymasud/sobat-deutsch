import { describe, it, expect } from 'vitest'
import { getGenderClue } from './genderClue'

// Ground truth from the domain-expert audit (2026-08-22), verified against
// the app's own 110,894-lemma dataset -- see docs/SCRATCH_FEATURE_NOTES.md.
// BR-DICT-05: a known exception must get NO clue (null), never a wrong one.
describe('getGenderClue', () => {
  it('matches the reliable suffixes with no known exceptions', () => {
    expect(getGenderClue('Freiheit', true)?.type).toBe('f')
    expect(getGenderClue('Möglichkeit', true)?.type).toBe('f')
    expect(getGenderClue('Freundschaft', true)?.type).toBe('f')
    expect(getGenderClue('Realität', true)?.type).toBe('f')
  })

  it('matches -ung/-ion as feminine for genuine derived nouns', () => {
    expect(getGenderClue('Ordnung', true)?.type).toBe('f')
    expect(getGenderClue('Situation', true)?.type).toBe('f')
  })

  it('does NOT give a misleading clue for known -ung ablaut-noun exceptions (der Sprung/Schwung/Dung)', () => {
    expect(getGenderClue('Sprung', true)).toBeNull()
    expect(getGenderClue('Schwung', true)).toBeNull()
    expect(getGenderClue('Dung', true)).toBeNull()
    expect(getGenderClue('Aufschwung', true)).toBeNull()
    expect(getGenderClue('Vorsprung', true)).toBeNull()
  })

  it('does NOT give a misleading clue for known -ion loanword exceptions (der Spion/Skorpion, das Stadion)', () => {
    expect(getGenderClue('Spion', true)).toBeNull()
    expect(getGenderClue('Skorpion', true)).toBeNull()
    expect(getGenderClue('Stadion', true)).toBeNull()
    expect(getGenderClue('Champion', true)).toBeNull()
  })

  it('matches -chen/-lein as neuter for genuine diminutives', () => {
    expect(getGenderClue('Häuschen', true)?.type).toBe('n')
    expect(getGenderClue('Mädchen', true)?.type).toBe('n')
  })

  it('does NOT give a misleading clue for known non-diminutive -chen/-lein words (der Kuchen etc.)', () => {
    expect(getGenderClue('Kuchen', true)).toBeNull()
    expect(getGenderClue('Knochen', true)).toBeNull()
    expect(getGenderClue('Drachen', true)).toBeNull()
    expect(getGenderClue('Rachen', true)).toBeNull()
    expect(getGenderClue('Groschen', true)).toBeNull()
  })

  it('matches agent-noun -er/-ling/-ismus as masculine', () => {
    expect(getGenderClue('Lehrer', true)?.type).toBe('m')
    expect(getGenderClue('Frühling', true)?.type).toBe('m')
    expect(getGenderClue('Tourismus', true)?.type).toBe('m')
  })

  it('does NOT give a misleading clue for known non-agent -er nouns (die Mutter, das Wasser, etc.)', () => {
    expect(getGenderClue('Mutter', true)).toBeNull()
    expect(getGenderClue('Wasser', true)).toBeNull()
    expect(getGenderClue('Fenster', true)).toBeNull()
    expect(getGenderClue('Butter', true)).toBeNull()
    expect(getGenderClue('Messer', true)).toBeNull()
  })

  it('does NOT give a misleading clue for English "-ing" loanwords colliding with the German -ling suffix', () => {
    expect(getGenderClue('Recycling', true)).toBeNull()
    expect(getGenderClue('Bowling', true)).toBeNull()
    expect(getGenderClue('Wrestling', true)).toBeNull()
  })

  it('the -er rule only applies to nouns (not verbs/other POS ending in -er)', () => {
    expect(getGenderClue('sauber', false)).toBeNull()
  })

  it('returns null for words matching no suffix pattern at all', () => {
    expect(getGenderClue('Tisch', true)).toBeNull()
  })
})
