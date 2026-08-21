// BR-DICT-15: `dictionary.level` stores 'A1'/'A2'/'B1' but this is a proxy
// derived from frequency_rank (scripts/assign_level_proxy.py), NOT real CEFR
// data (no Goethe-Institut wordlist involved) -- so the UI must never label
// it as a CEFR level. This maps the stored tier code to an honest label.
const TIER_LABELS: Record<string, string> = {
  A1: 'Sering dipakai',
  A2: 'Menengah',
  B1: 'Jarang dipakai',
}

export const getFrequencyTierLabel = (level: string | null): string | null =>
  level ? TIER_LABELS[level] ?? null : null
