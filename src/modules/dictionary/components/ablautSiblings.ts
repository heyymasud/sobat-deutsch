import type { DictionaryEntry } from '../types'

// AC-GRAM-03: pick up to `limit` OTHER verbs sharing the same ablaut_class (excluding the current word).
export const pickAblautSiblings = (
  candidates: DictionaryEntry[],
  currentLemma: string,
  limit = 5
): DictionaryEntry[] => candidates.filter((c) => c.lemma !== currentLemma).slice(0, limit)
