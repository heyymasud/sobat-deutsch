import type { MistakeTrackerEntry } from '../../../core/db/dictionaryDb'

// FR-STAT-03: top N words by mistake count, descending.
export const topMistakes = (entries: MistakeTrackerEntry[], limit = 10): MistakeTrackerEntry[] =>
  [...entries].sort((a, b) => b.mistakeCount - a.mistakeCount).slice(0, limit)
