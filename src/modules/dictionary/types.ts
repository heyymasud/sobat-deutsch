export interface DictionaryEntry {
  id: number
  lemma: string
  pos: string | null
  gender: 'm' | 'f' | 'n' | null
  plural: string | null
  genitiv_singular: string | null
  translations: string | null
  example: string | null
  separable_prefix: string | null
  auxiliary: 'haben' | 'sein' | 'both' | null
  verb_class: 'weak' | 'strong' | 'mixed' | 'irregular' | null
  ablaut_class: string | null
  case_governance: string[] | null
  conjugation_table: {
    praesens?: Record<string, string>
    praeteritum?: Record<string, string>
    perfekt?: Record<string, string>
  } | null
  comparative: string | null
  superlative: string | null
  level: 'A1' | 'A2' | 'B1' | null
  theme_tags: string[] | null
  frequency_rank: number | null
}
