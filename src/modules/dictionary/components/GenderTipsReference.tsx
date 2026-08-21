import React from 'react'
import { GENDER_CLUE_RULES } from '../utils/genderClue'

const ARTICLE_BY_TYPE = { m: 'der', f: 'die', n: 'das' } as const

// Standalone reference for all gender-suffix patterns at once -- distinct
// from the per-word "Petunjuk Pola" card (WordDetail.tsx) and the
// per-mistake hint (ArtikelRush.tsx), which only ever show ONE rule at a
// time for whichever word is in front of the user.
export const GenderTipsReference: React.FC = () => {
  return (
    <div className="flex flex-col gap-3 text-left">
      {GENDER_CLUE_RULES.map((r) => (
        <div key={r.suffixLabel} className="flex items-start gap-3 bg-surface-muted rounded-xl p-3">
          <span className={`badge-gender badge-gender-${r.type} shrink-0 mt-0.5`}>{ARTICLE_BY_TYPE[r.type]}</span>
          <div>
            <div className="font-display font-bold text-sm text-ink">{r.suffixLabel}</div>
            <p className="text-xs text-ink-muted mt-0.5">{r.rule}</p>
            <p className="text-xs text-ink-faint mt-1">
              <span className="font-semibold">Contoh: </span>{r.example}
            </p>
            {r.caveat && (
              <p className="text-xs text-ink-faint mt-1.5 leading-relaxed">
                <span className="font-semibold">Catatan: </span>{r.caveat}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
