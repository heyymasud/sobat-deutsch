// Shared with WordDetail.tsx (reference display, FR-DICT-11/AC-DICT-06),
// ArtikelRush.tsx (contextual hint on wrong answer, FR-QUIZ-13), and
// GenderTipsReference.tsx (full-list reference, independent of any single
// word) — one rule table, not duplicated (BR-QUIZ-07).
//
// Reliability audited (senior German-teacher review, 2026-08-22) against the
// app's own 110,894-lemma dataset, not just general knowledge -- see
// docs/SCRATCH_FEATURE_NOTES.md for the query methodology and full findings.
// BR-DICT-05: a known exception must never be given a misleading clue, so
// each rule below excludes its concrete known counter-examples (returns no
// clue for them) rather than merely softening the wording.
export interface GenderClueRule {
  suffixLabel: string
  rule: string
  /** Genuine correct example word(s) for this rule, so the tip isn't just an
   * abstract pattern -- shown alongside `rule` everywhere it's displayed. */
  example: string
  /** Longer explanation shown only in the full reference list (GenderTipsReference) --
   * names the known exceptions and WHY they're exceptions, not just "except X". */
  caveat?: string
  type: 'm' | 'f' | 'n'
  matches: (word: string, isNoun: boolean) => boolean
}

// -chen/-lein grammatically force neuter ONLY when they're a genuine diminutive
// formation (Frauchen, Mädchen, Häuschen). Many common words merely end in
// those letters as part of their root, with no diminutive meaning at all --
// verified against the app's dictionary: all masculine, not neuter.
const CHEN_LEIN_NON_DIMINUTIVE_EXCEPTIONS = new Set([
  'kuchen', 'knochen', 'drachen', 'rachen', 'groschen', 'latschen', 'rochen', 'krachen',
])

// "-ung" reliably marks a feminine nominalized verb (Ordnung, Zeitung, Wohnung)
// EXCEPT for a small set of deverbal nouns formed by ablaut (vowel change) where
// "-ung" is coincidentally the tail of the root, not the suffix -- e.g. Sprung
// is springen's ablaut noun (sprang), not "spr+ung". Verified: 49/4189 -ung
// nouns in the dataset are masculine, essentially all in this family.
const UNG_ABLAUT_EXCEPTION_ROOTS = ['sprung', 'schwung']

// Whole borrowed words that happen to end in "-ion" without being the Latin
// "-tion/-sion" abstract-noun suffix (Situation, Aktion, Region). Verified
// against the dataset.
const ION_LOANWORD_EXCEPTIONS = new Set(['spion', 'skorpion', 'champion', 'stadion'])

// English "-ing" loanwords (Recycling, Bowling, Wrestling) coincidentally end
// in the same 4 letters as the German "-ling" suffix (Lehrling, Frühling)
// when the preceding letter is "l" -- a string-matching collision, not a
// real exception to the German suffix itself. Verified against the dataset.
const LING_ENGLISH_LOANWORD_EXCEPTIONS = new Set([
  'recycling', 'bowling', 'wrestling', 'reeling', 'helling', 'reling', 'marshalling', 'upselling',
])

// The masculine "-er" tendency genuinely only applies to agent/profession
// nouns (Lehrer, Bäcker -- "one who does X"). Verified against the dataset:
// these common non-agent nouns ending in "-er" are feminine/neuter, ranked
// among the top ~2000 most-frequent words -- exactly the ones a beginner
// would hit first and be misled by. ("Leiter" deliberately excluded from
// this list: der Leiter/die Leiter is a genuine homonym, not a clean case.)
const ER_NON_AGENT_EXCEPTIONS = new Set([
  'mutter', 'wasser', 'fenster', 'tochter', 'schwester', 'nummer', 'feuer', 'zimmer',
  'opfer', 'wunder', 'monster', 'messer', 'meer', 'tier', 'lager', 'butter', 'kammer', 'mauer', 'bier',
])

export const GENDER_CLUE_RULES: GenderClueRule[] = [
  {
    suffixLabel: '-keit, -heit, -schaft, -tät',
    rule: 'Akhiran -keit, -heit, -schaft, -tät selalu Feminin.',
    example: 'die Freiheit, die Möglichkeit, die Freundschaft, die Realität',
    type: 'f',
    matches: (word) =>
      word.endsWith('keit') || word.endsWith('heit') || word.endsWith('schaft') || word.endsWith('tät'),
  },
  {
    suffixLabel: '-ung',
    rule: 'Akhiran -ung hampir selalu Feminin.',
    example: 'die Ordnung, die Zeitung, die Wohnung',
    caveat:
      'Kecuali der Sprung, der Schwung, der Dung (dan kata turunannya, mis. der Aufschwung, der Vorsprung) -- di situ "-ung" cuma kebetulan bagian akar kata kerja tak beraturan (springen -> Sprung), bukan akhiran pembentuk nomina.',
    type: 'f',
    matches: (word) => {
      if (UNG_ABLAUT_EXCEPTION_ROOTS.some((root) => word.endsWith(root)) || word === 'dung' || word.endsWith('dung')) {
        return false
      }
      return word.endsWith('ung')
    },
  },
  {
    suffixLabel: '-tion, -sion (-ion)',
    rule: 'Akhiran -tion, -sion hampir selalu Feminin.',
    example: 'die Situation, die Nation, die Aktion',
    caveat:
      'Kecuali kata pinjaman utuh yang kebetulan berakhiran -ion tanpa benar-benar akhiran Latin "-tion/-sion", seperti der Spion, der Skorpion, der Champion, dan das Stadion.',
    type: 'f',
    matches: (word) => {
      if (ION_LOANWORD_EXCEPTIONS.has(word)) return false
      return word.endsWith('ion')
    },
  },
  {
    suffixLabel: '-chen, -lein (diminutif)',
    rule: 'Akhiran -chen dan -lein selalu Netral -- KALAU benar-benar bentuk diminutif (kata kecil/sayang).',
    example: 'das Häuschen, das Mädchen, das Fräulein',
    caveat:
      'Banyak kata lain kebetulan berakhiran sama tapi BUKAN diminutif, jadi bukan netral -- mis. der Kuchen (kue), der Knochen (tulang), der Drachen (naga/layang-layang), der Rachen (kerongkongan), der Groschen (koin). "-chen" di situ cuma kebetulan bagian kata dasarnya, bukan akhiran kecil/sayang.',
    type: 'n',
    matches: (word) => {
      if (CHEN_LEIN_NON_DIMINUTIVE_EXCEPTIONS.has(word)) return false
      return word.endsWith('chen') || word.endsWith('lein')
    },
  },
  {
    suffixLabel: '-er (pelaku/profesi), -ling, -ismus',
    rule: 'Akhiran -er untuk KATA BENDA PELAKU/PROFESI, serta -ling dan -ismus, biasanya Maskulin.',
    example: 'der Lehrer, der Bäcker, der Frühling, der Tourismus',
    caveat:
      'Rule ini TIDAK berlaku untuk kata benda lain yang kebetulan berakhiran -er -- banyak yang feminin/netral, mis. die Mutter, das Wasser, das Fenster, die Butter, das Messer. Untuk -ling: kata pinjaman Inggris seperti das Recycling, das Bowling, das Wrestling bukan Maskulin, itu akhiran "-ing" Inggris, bukan "-ling" Jerman.',
    type: 'm',
    matches: (word, isNoun) => {
      if (LING_ENGLISH_LOANWORD_EXCEPTIONS.has(word) || ER_NON_AGENT_EXCEPTIONS.has(word)) return false
      return word.endsWith('ling') || word.endsWith('ismus') || (word.endsWith('er') && isNoun)
    },
  },
]

export const getGenderClue = (
  lemma: string,
  isNoun: boolean
): { rule: string; example: string; caveat?: string; type: 'm' | 'f' | 'n' } | null => {
  const word = lemma.toLowerCase()
  for (const r of GENDER_CLUE_RULES) {
    if (r.matches(word, isNoun)) return { rule: r.rule, example: r.example, caveat: r.caveat, type: r.type }
  }
  return null
}
