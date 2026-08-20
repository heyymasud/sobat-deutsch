import React, { useState, useEffect } from 'react'
import { supabase } from '../../../core/api/supabaseClient'
import { SuggestCorrection } from '../../teacher/components/SuggestCorrection'
import { MySuggestions } from '../../teacher/components/MySuggestions'
import { ReportWordModal } from './ReportWordModal'
import { db } from '../../../core/db/dictionaryDb'
import { pickAblautSiblings } from './ablautSiblings'
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
        return { color: 'text-gender-m border-gender-m bg-blue-50', text: 'der (maskulin)' }
      case 'f':
        return { color: 'text-gender-f border-gender-f bg-red-50', text: 'die (feminin)' }
      case 'n':
        return { color: 'text-gender-n border-gender-n bg-green-50', text: 'das (netral)' }
      default:
        return { color: 'text-gray-500 border-gray-300 bg-gray-50', text: 'data tidak tersedia' }
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

  // Suffix Gender Clues check
  const getGenderClue = (lemma: string): { rule: string; type: 'm' | 'f' | 'n' } | null => {
    const word = lemma.toLowerCase()
    if (word.endsWith('ung') || word.endsWith('keit') || word.endsWith('heit') || 
        word.endsWith('schaft') || word.endsWith('ion') || word.endsWith('tät')) {
      return { rule: 'Akhiran -ung, -keit, -heit, -schaft, -ion, -tät selalu Feminin.', type: 'f' }
    }
    if (word.endsWith('chen') || word.endsWith('lein')) {
      return { rule: 'Akhiran -chen dan -lein selalu Netral.', type: 'n' }
    }
    if (word.endsWith('ling') || word.endsWith('ismus') || (word.endsWith('er') && isNoun)) {
      return { rule: 'Akhiran -er (pelaku), -ling, -ismus biasanya Maskulin.', type: 'm' }
    }
    return null
  };

  const genderClue = getGenderClue(entry.lemma)

  // Table of 4 German cases (Deklinasi 4 Kasus - S5-07)
  const getDeclensionTable = () => {
    if (!isNoun || !entry.gender) return null

    const cases = [
      { name: 'Nominativ (Subjek)', m: 'der', f: 'die', n: 'das', pl: 'die' },
      { name: 'Akkusativ (Objek Langsung)', m: 'den', f: 'die', n: 'das', pl: 'die' },
      { name: 'Dativ (Objek Tidak Langsung)', m: 'dem', f: 'der', n: 'dem', pl: 'den' },
      { name: 'Genitiv (Kepemilikan)', m: 'des', f: 'der', n: 'des', pl: 'der' },
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
      <div className="mb-6 border rounded-lg overflow-hidden shadow-sm bg-white">
        <h3 className="text-sm font-bold text-gray-700 bg-gray-50 px-4 py-2 border-b">Tabel Deklinasi Artikel Definit</h3>
        <table className="w-full text-left text-xs border-collapse divide-y divide-gray-200">
          <thead className="bg-gray-50/50 font-semibold text-gray-500">
            <tr>
              <th className="px-4 py-2">Kasus</th>
              <th className="px-4 py-2">Singular</th>
              <th className="px-4 py-2">Plural</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-150 text-gray-800">
            {cases.map((c) => {
              const artSing = c[entry.gender!]
              const endingSing = c.name.startsWith('Genitiv') ? genitivSingularText : ''
              const nounPlural = entry.plural 
                ? `${c.pl} ${c.name.startsWith('Dativ') ? dativPluralNoun : entry.plural}`
                : <span className="text-gray-400 font-normal italic">tidak tersedia</span>

              return (
                <tr key={c.name} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 font-medium text-gray-500">{c.name}</td>
                  <td className="px-4 py-2.5 font-semibold text-indigo-700">
                    {artSing} {nounWord}{endingSing}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-indigo-700">{nounPlural}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 max-w-2xl mx-auto my-6 text-left relative">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{displayLemma}</h1>
            <button
              onClick={handlePlayAudio}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition"
              title="Putar pengucapan"
              aria-label="Putar pengucapan"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            {entry.pos && (
              <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full">
                {entry.pos.toUpperCase()}
              </span>
            )}
            {entry.level && (
              <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-full">
                {entry.level}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {['teacher', 'admin'].includes(role) && (
            <>
              <button
                onClick={() => setShowCorrectionModal(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 rounded-lg transition shadow-sm text-sm"
              >
                Ajukan Koreksi Kata
              </button>
              <button
                onClick={() => setShowMySuggestions(true)}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-lg transition text-sm"
              >
                Saran Saya
              </button>
            </>
          )}

          <button
            onClick={() => setShowReportModal(true)}
            className="text-gray-400 hover:text-red-600 font-medium px-2 py-2 transition text-xs underline"
            title="Laporkan kesalahan pada entri kata ini"
          >
            Laporkan kesalahan
          </button>

          {onAddToDeck && (
            <button
              onClick={() => onAddToDeck(entry)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg transition shadow-sm text-sm"
            >
              Tambah ke Deck
            </button>
          )}
        </div>
      </div>

      {/* Gender & Articles (Nomina Only) */}
      {isNoun && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Gender & Artikel</h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Gender:</span>
              <span className={`px-3 py-1 border text-sm font-bold rounded-full ${genderInfo.color}`}>
                {genderInfo.text}
              </span>
            </div>

            {articles ? (
              <div className="grid grid-cols-3 gap-2 text-center text-sm mt-1">
                <div className="bg-white p-2 border rounded shadow-sm">
                  <div className="text-xs text-gray-400">Definit</div>
                  <div className="font-bold text-gray-800">{articles.def}</div>
                </div>
                <div className="bg-white p-2 border rounded shadow-sm">
                  <div className="text-xs text-gray-400">Indefinit</div>
                  <div className="font-bold text-gray-800">{articles.indef}</div>
                </div>
                <div className="bg-white p-2 border rounded shadow-sm">
                  <div className="text-xs text-gray-400">Negasi</div>
                  <div className="font-bold text-gray-800">{articles.neg}</div>
                </div>
              </div>
            ) : (
              <span className="text-sm text-gray-500 italic">Artikel tidak tersedia</span>
            )}

            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm font-medium">Plural:</span>
              <span className="font-bold text-gray-800">
                {entry.plural ? `die ${entry.plural}` : <span className="text-gray-400 font-normal italic">data tidak tersedia</span>}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Declension Table (Nomina Only) */}
      {getDeclensionTable()}

      {/* Verb Specific Section (S5-05 & S5-06) */}
      {isVerb && (
        <div className="mb-6 p-4 border rounded-lg bg-indigo-50/30">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Tata Bahasa Verba</h2>
          <div className="flex flex-col gap-2.5 text-sm mb-4">
            {entry.auxiliary && (
              <div>
                Kata Bantu Perfekt: <strong className="text-indigo-700">{entry.auxiliary}</strong>
              </div>
            )}
            {entry.verb_class && (
              <div>
                Kelas Verba: <strong className="text-indigo-700 uppercase">{entry.verb_class}</strong>
              </div>
            )}
            {entry.separable_prefix && (
              <div className="bg-white p-2 border rounded text-xs">
                💡 Kata kerja dapat dipisah (trennbare Verben). Awalan: <strong>{entry.separable_prefix}</strong>
              </div>
            )}
            {entry.ablaut_class && (
              <div>
                Pola Perubahan Ablaut: <strong className="text-indigo-700">{entry.ablaut_class}</strong>
                {ablautSiblings.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {ablautSiblings.map((sibling) => (
                      <span
                        key={sibling.id}
                        className="bg-white border rounded px-2 py-1 text-xs text-gray-600"
                        title={sibling.translations || undefined}
                      >
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
                <div key={tense} className="bg-white p-3 border rounded shadow-xs text-xs">
                  <h4 className="font-bold text-gray-700 uppercase mb-2 border-b pb-1 text-center">{tense}</h4>
                  <div className="flex flex-col gap-1 text-gray-600">
                    {Object.entries(forms || {}).map(([person, form]) => (
                      <div key={person} className="flex justify-between">
                        <span className="font-medium text-gray-400">{person}</span>
                        <span className="font-bold text-indigo-700">{form as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400 italic">Tabel konjugasi tidak tersedia</div>
          )}
        </div>
      )}

      {/* Case Governance (S5-08) */}
      {entry.case_governance && entry.case_governance.length > 0 && (
        <div className="mb-6 p-4 border border-amber-200 rounded-lg bg-amber-50/30">
          <h2 className="text-sm font-bold text-amber-900 uppercase tracking-wider mb-2">Kasus Penyerta (Case Governance)</h2>
          <div className="flex flex-wrap gap-2">
            {entry.case_governance.map((gov, index) => (
              <span key={index} className="bg-white text-amber-800 font-bold px-3 py-1 border border-amber-200 rounded-full text-xs">
                {gov}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Translations */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Terjemahan</h2>
        <p className="text-gray-800 text-lg leading-relaxed">
          {entry.translations ? entry.translations : <span className="text-gray-400 italic">data tidak tersedia</span>}
        </p>
      </div>

      {/* Suffix Gender Clue */}
      {isNoun && genderClue && (
        <div className="mb-6 p-4 border border-indigo-100 rounded-lg bg-indigo-50/50">
          <h2 className="text-sm font-semibold text-indigo-900 mb-1">Clue Gender Akhiran</h2>
          <p className="text-sm text-indigo-700">{genderClue.rule}</p>
        </div>
      )}

      {/* Kalimat Contoh */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Kalimat Contoh</h2>
        {entry.example ? (
          <div className="border-l-4 border-indigo-500 pl-4 py-1 italic bg-gray-50 rounded-r-lg pr-4">
            <p className="text-gray-800 font-medium">{entry.example}</p>
          </div>
        ) : (
          <p className="text-gray-400 italic">data tidak tersedia</p>
        )}
      </div>

      {/* Atribusi Sumber */}
      <div className="mt-8 pt-4 border-t border-gray-100 text-xs text-gray-400 text-center">
        Data bersumber dari Wiktionary via <a href="https://kaikki.org" target="_blank" rel="noreferrer" className="underline hover:text-gray-600">kaikki.org</a>. Berlisensi <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer" className="underline hover:text-gray-600">CC BY-SA 3.0</a>.
      </div>

      {/* Suggest Correction Modal */}
      {showCorrectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-w-lg w-full">
            <button
              onClick={() => setShowCorrectionModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-lg font-bold"
            >
              ✕
            </button>
            <SuggestCorrection entry={entry} onClose={() => setShowCorrectionModal(false)} />
          </div>
        </div>
      )}

      {/* My Suggestions History Modal (S6-06) */}
      {showMySuggestions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-w-lg w-full max-h-[80vh] overflow-y-auto bg-white border rounded-2xl p-6 shadow-lg">
            <button
              onClick={() => setShowMySuggestions(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-lg font-bold"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Saran Saya</h2>
            <MySuggestions />
          </div>
        </div>
      )}

      {/* Report Word Modal (S6-10) */}
      {showReportModal && (
        <ReportWordModal wordId={entry.id} lemma={entry.lemma} onClose={() => setShowReportModal(false)} />
      )}
    </div>
  )
}
