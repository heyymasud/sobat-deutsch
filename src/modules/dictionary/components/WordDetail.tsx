import React, { useState, useEffect } from 'react'
import { supabase } from '../../../core/api/supabaseClient'
import { SuggestCorrection } from '../../teacher/components/SuggestCorrection'
import { MySuggestions } from '../../teacher/components/MySuggestions'
import { ReportWordModal } from './ReportWordModal'
import { db } from '../../../core/db/dictionaryDb'
import { pickAblautSiblings } from './ablautSiblings'
import { getGenderClue } from '../utils/genderClue'
import { getFrequencyTierLabel } from '../utils/frequencyTier'
import { GenderTipsModal } from './GenderTipsModal'
import { Modal } from '../../../components/Modal'
import type { DictionaryEntry } from '../types'

interface WordDetailProps {
  entry: DictionaryEntry
  onAddToDeck?: (entry: DictionaryEntry) => void
}

export const WordDetail: React.FC<WordDetailProps> = ({ entry, onAddToDeck }) => {
  const [role, setRole] = useState<string>('student')
  const [showCorrectionModal, setShowCorrectionModal] = useState(false)
  const [showMySuggestions, setShowMySuggestions] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [ablautSiblings, setAblautSiblings] = useState<DictionaryEntry[]>([])
  const [showGenderTips, setShowGenderTips] = useState(false)

  const isNoun = entry.pos?.toLowerCase() === 'noun'
  const isVerb = entry.pos?.toLowerCase() === 'verb'

  // Capitalize noun lemma according to German rules
  const displayLemma = isNoun
    ? entry.lemma.charAt(0).toUpperCase() + entry.lemma.slice(1)
    : entry.lemma

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        supabase
          .from('profiles')
          .select('role')
          .eq('id', data.session.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile) setRole(profile.role)
          })
      }
    })
  }, [entry])

  // AC-GRAM-03: load sibling verbs sharing the same ablaut_class as reference examples.
  useEffect(() => {
    const ablautClass = entry.ablaut_class
    if (!ablautClass) return

    let cancelled = false
    db.dictionary
      .filter((w) => w.ablaut_class === ablautClass)
      .toArray()
      .then((matches) => {
        if (!cancelled) setAblautSiblings(pickAblautSiblings(matches, entry.lemma))
      })
      .catch(() => {
        if (!cancelled) setAblautSiblings([])
      })
    return () => {
      cancelled = true
    }
  }, [entry])

  // Text-To-Speech (Web Speech API)
  const handlePlayAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(entry.lemma)
      utterance.lang = 'de-DE'
      window.speechSynthesis.speak(utterance)
    } else {
      alert('Browser Anda tidak mendukung Web Speech API.')
    }
  };

  // Helper for gender styling
  const getGenderStyle = (gender: string | null) => {
    switch (gender) {
      case 'm':
        return { badgeCls: 'badge-gender-m', text: 'der (maskulin)' }
      case 'f':
        return { badgeCls: 'badge-gender-f', text: 'die (feminin)' }
      case 'n':
        return { badgeCls: 'badge-gender-n', text: 'das (netral)' }
      default:
        return { badgeCls: '', text: 'data tidak tersedia' }
    }
  };

  const genderInfo = getGenderStyle(entry.gender)

  // Get articles
  const getArticles = (gender: string | null) => {
    switch (gender) {
      case 'm':
        return { def: 'der', indef: 'ein', neg: 'kein' }
      case 'f':
        return { def: 'die', indef: 'eine', neg: 'keine' }
      case 'n':
        return { def: 'das', indef: 'ein', neg: 'kein' }
      default:
        return null
    }
  };

  const articles = getArticles(entry.gender)

  // Suffix Gender Clues check (BR-QUIZ-07: shared rule, also used by ArtikelRush)
  const genderClue = getGenderClue(entry.lemma, isNoun)

  // Table of 4 German cases (Deklinasi 4 Kasus - S5-07)
  const getDeclensionTable = () => {
    if (!isNoun || !entry.gender) return null

    const cases = [
      { name: 'Nominativ', full: 'Subjek', m: 'der', f: 'die', n: 'das', pl: 'die' },
      { name: 'Akkusativ', full: 'Objek Langsung', m: 'den', f: 'die', n: 'das', pl: 'die' },
      { name: 'Dativ', full: 'Objek Tidak Langsung', m: 'dem', f: 'der', n: 'dem', pl: 'den' },
      { name: 'Genitiv', full: 'Kepemilikan', m: 'des', f: 'der', n: 'des', pl: 'der' },
    ]

    const genitivSingularText = entry.genitiv_singular ? ` (${entry.genitiv_singular})` : ''
    const nounWord = entry.lemma.charAt(0).toUpperCase() + entry.lemma.slice(1)

    // Dativ plural adds 'n' if it doesn't end in n or s
    let dativPluralNoun = entry.plural ? `die ${entry.plural}` : null
    if (entry.plural) {
      const plLower = entry.plural.toLowerCase()
      if (!plLower.endsWith('n') && !plLower.endsWith('s')) {
        dativPluralNoun = `${entry.plural}n`
      } else {
        dativPluralNoun = entry.plural
      }
    }

    return (
      <div className="mb-6 card overflow-hidden">
        <h3 className="text-xs font-display font-bold uppercase tracking-wider text-ink-muted bg-surface-muted px-4 py-2.5 border-b border-border">
          Tabel Deklinasi Artikel Definit
        </h3>
        <table className="w-full text-left text-sm border-collapse">
          <thead className="text-ink-faint text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium">Kasus</th>
              <th className="px-4 py-2 font-medium">Singular</th>
              <th className="px-4 py-2 font-medium">Plural</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cases.map((c) => {
              const artSing = c[entry.gender!]
              const endingSing = c.name.startsWith('Genitiv') ? genitivSingularText : ''
              const nounPlural = entry.plural
                ? `${c.pl} ${c.name.startsWith('Dativ') ? dativPluralNoun : entry.plural}`
                : <span className="text-ink-faint font-normal italic">tidak tersedia</span>

              return (
                <tr key={c.name} className="hover:bg-surface-muted/60">
                  <td className="px-4 py-2.5 font-medium text-ink-muted">
                    {c.name} <span className="text-ink-faint font-normal">({c.full})</span>
                  </td>
                  <td className="px-4 py-2.5 font-semibold font-display text-brand">
                    {artSing} {nounWord}{endingSing}
                  </td>
                  <td className="px-4 py-2.5 font-semibold font-display text-brand">{nounPlural}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  };

  const genderVar =
    entry.gender === 'm' ? 'var(--color-gender-m)' :
    entry.gender === 'f' ? 'var(--color-gender-f)' :
    entry.gender === 'n' ? 'var(--color-gender-n)' : undefined

  return (
    <div className="max-w-2xl mx-auto text-left">
      {/* Header card */}
      <div className="card p-6 md:p-10 relative overflow-hidden"
        style={genderVar ? { boxShadow: `inset 4px 0 0 ${genderVar}` } : undefined}>
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <div className="flex gap-2 flex-wrap mb-3">
              {entry.pos && <span className="badge">{entry.pos.toUpperCase()}</span>}
              {getFrequencyTierLabel(entry.level) && (
                <span className="badge badge-accent">{getFrequencyTierLabel(entry.level)}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <h1 className="page-title text-4xl md:text-5xl">
                {articles && <span className={`text-gender-${entry.gender}`}>{articles.def} </span>}
                {displayLemma}
              </h1>
              {/* FR-DICT-18/BR-DICT-13: IPA shown next to TTS only when present */}
              {entry.ipa && (
                <span className="text-sm text-ink-faint font-mono" title="Transkripsi IPA">
                  {entry.ipa}
                </span>
              )}
              <button
                onClick={handlePlayAudio}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border hover:bg-surface-muted text-ink-muted transition-colors"
                title="Putar pengucapan"
                aria-label="Putar pengucapan"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {['teacher', 'admin'].includes(role) && (
              <>
                <button onClick={() => setShowCorrectionModal(true)} className="btn-secondary !py-2 !px-3 text-sm">
                  Ajukan Koreksi
                </button>
                <button onClick={() => setShowMySuggestions(true)} className="btn-secondary !py-2 !px-3 text-sm">
                  Saran Saya
                </button>
              </>
            )}

            {onAddToDeck && (
              <button onClick={() => onAddToDeck(entry)} className="btn-primary !py-2.5 !px-5 text-sm">
                + Tambah ke Deck
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowReportModal(true)}
          className="mt-6 text-ink-faint hover:text-danger font-medium text-xs underline"
          title="Laporkan kesalahan pada entri kata ini"
        >
          Laporkan kesalahan pada entri ini
        </button>
      </div>

      {/* Body sections — each its own card, generously spaced (never nested) */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Gender & Articles (Nomina Only) */}
        {isNoun && (
          <div className="card p-6">
            <h2 className="eyebrow mb-4">Gender & Artikel</h2>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-ink-muted">Gender:</span>
                <span className={genderInfo.badgeCls ? `badge-gender badge-gender-lg ${genderInfo.badgeCls}` : 'badge'}>
                  {genderInfo.text}
                </span>
              </div>

              {articles ? (
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  {(['Definit', 'Indefinit', 'Negasi'] as const).map((label, i) => {
                    const val = [articles.def, articles.indef, articles.neg][i]
                    return (
                      <div key={label} className="bg-surface-muted p-3 rounded-xl">
                        <div className="text-xs text-ink-faint">{label}</div>
                        <div className="font-display font-bold text-ink mt-0.5">{val}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <span className="text-sm text-ink-faint italic">Artikel tidak tersedia</span>
              )}

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-ink-muted">Plural:</span>
                <span className="font-display font-bold text-ink">
                  {entry.plural ? `die ${entry.plural}` : <span className="text-ink-faint font-normal italic">data tidak tersedia</span>}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Gender clue */}
        <div className="card p-6">
          <h2 className="eyebrow mb-4">Petunjuk Pola</h2>
          {isNoun && genderClue ? (
            <>
              <p className="text-sm text-ink-muted leading-relaxed">{genderClue.rule}</p>
              <p className="text-xs text-ink-faint mt-1.5">
                <span className="font-semibold">Contoh: </span>{genderClue.example}
              </p>
              {genderClue.caveat && (
                <p className="text-xs text-ink-faint leading-relaxed mt-2">
                  <span className="font-semibold">Catatan: </span>{genderClue.caveat}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-faint italic">Tidak ada pola akhiran khusus yang cocok untuk kata ini.</p>
          )}

          <button
            onClick={() => setShowGenderTips(true)}
            className="mt-4 text-xs text-brand hover:underline font-semibold"
          >
            Lihat semua pola akhiran →
          </button>
          {showGenderTips && <GenderTipsModal onClose={() => setShowGenderTips(false)} />}
        </div>

        {/* FR-DICT-19/20, BR-DICT-13: whole card hidden if neither field exists */}
        {(entry.etymology || entry.hyphenation) && (
          <div className="card p-6 md:col-span-2">
            <h2 className="eyebrow mb-4">Etimologi & Suku Kata</h2>
            <div className="flex flex-col gap-2.5 text-sm">
              {entry.hyphenation && (
                <div className="text-ink-muted">
                  Suku kata: <strong className="text-brand font-display">{entry.hyphenation}</strong>
                </div>
              )}
              {entry.etymology && (
                <p className="text-ink-muted leading-relaxed">{entry.etymology}</p>
              )}
            </div>
          </div>
        )}

        {/* Verb Specific Section (S5-05 & S5-06) */}
        {isVerb && (
          <div className="card p-6 md:col-span-2">
            <h2 className="eyebrow mb-4">Tata Bahasa Verba</h2>
            <div className="flex flex-col gap-2.5 text-sm mb-4 text-ink-muted">
              {entry.auxiliary && (
                <div>Kata Bantu Perfekt: <strong className="text-brand font-display">{entry.auxiliary}</strong></div>
              )}
              {entry.verb_class && (
                <div>Kelas Verba: <strong className="text-brand font-display uppercase">{entry.verb_class}</strong></div>
              )}
              {entry.separable_prefix && (
                <div className="bg-surface-muted p-3 rounded-xl text-xs">
                  Kata kerja dapat dipisah (trennbare Verben). Awalan: <strong className="text-ink">{entry.separable_prefix}</strong>
                </div>
              )}
              {entry.ablaut_class && (
                <div>
                  Pola Perubahan Ablaut: <strong className="text-brand font-display">{entry.ablaut_class}</strong>
                  {ablautSiblings.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ablautSiblings.map((sibling) => (
                        <span key={sibling.id} className="badge" title={sibling.translations || undefined}>
                          {sibling.lemma}
                          {sibling.translations ? ` — ${sibling.translations}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Conjugation tables */}
            {entry.conjugation_table ? (
              <div className="grid sm:grid-cols-3 gap-3">
                {Object.entries(entry.conjugation_table).map(([tense, forms]) => (
                  <div key={tense} className="bg-surface-muted p-3 rounded-xl text-xs">
                    <h4 className="font-display font-bold text-ink-muted uppercase mb-2 border-b border-border pb-1 text-center">{tense}</h4>
                    <div className="flex flex-col gap-1">
                      {Object.entries(forms || {}).map(([person, form]) => (
                        <div key={person} className="flex justify-between">
                          <span className="font-medium text-ink-faint">{person}</span>
                          <span className="font-display font-bold text-brand">{form as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-ink-faint italic">Tabel konjugasi tidak tersedia</div>
            )}
          </div>
        )}

        {/* Case Governance (S5-08) */}
        {entry.case_governance && entry.case_governance.length > 0 && (
          <div className="card p-6 md:col-span-2">
            <h2 className="eyebrow mb-3">Kasus Penyerta (Case Governance)</h2>
            <div className="flex flex-wrap gap-2">
              {entry.case_governance.map((gov, index) => (
                <span key={index} className="badge badge-accent">{gov}</span>
              ))}
            </div>
          </div>
        )}

        {/* Declension Table (Nomina Only) */}
        {isNoun && getDeclensionTable()}

        {/* Translations */}
        <div className="card p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="eyebrow">Terjemahan (Inggris)</h2>
            <span className="badge-status badge-status-neutral">B. Indonesia segera hadir</span>
          </div>
          <p className="text-ink text-lg leading-relaxed">
            {entry.translations ? entry.translations : <span className="text-ink-faint italic">data tidak tersedia</span>}
          </p>
        </div>

        {/* Kalimat Contoh */}
        <div className="card p-6">
          <h2 className="eyebrow mb-3">Kalimat Contoh</h2>
          {entry.example ? (
            <p className="text-ink font-medium italic leading-relaxed">{entry.example}</p>
          ) : (
            <p className="text-ink-faint italic text-sm">data tidak tersedia</p>
          )}
        </div>
      </div>

      {/* Atribusi Sumber */}
      <p className="mt-8 text-xs text-ink-faint text-center">
        Data bersumber dari Wiktionary via <a href="https://kaikki.org" target="_blank" rel="noreferrer" className="underline hover:text-brand">kaikki.org</a>. Berlisensi <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer" className="underline hover:text-brand">CC BY-SA 3.0</a>.
      </p>

      {/* Suggest Correction Modal */}
      {showCorrectionModal && (
        <SuggestCorrection entry={entry} onClose={() => setShowCorrectionModal(false)} />
      )}

      {/* My Suggestions History Modal (S6-06) */}
      {showMySuggestions && (
        <Modal title="Saran Saya" onClose={() => setShowMySuggestions(false)} maxWidthClassName="max-w-lg">
          <MySuggestions />
        </Modal>
      )}

      {/* Report Word Modal (S6-10) */}
      {showReportModal && (
        <ReportWordModal wordId={entry.id} lemma={entry.lemma} onClose={() => setShowReportModal(false)} />
      )}
    </div>
  )
}
