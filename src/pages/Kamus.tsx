import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { SearchBar } from '../modules/dictionary/components/SearchBar'
import { WordDetail } from '../modules/dictionary/components/WordDetail'
import { db } from '../core/db/dictionaryDb'
import { useAppLayout } from '../layouts/AppLayout'
import type { DictionaryEntry } from '../modules/dictionary/types'

const HISTORY_KEY = 'kamus_search_history'
const HISTORY_LIMIT = 8

function loadHistory(): DictionaryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

export default function Kamus() {
  const { openAddToDeck } = useAppLayout()
  const [selectedEntry, setSelectedEntry] = useState<DictionaryEntry | null>(null)
  const [history, setHistory] = useState<DictionaryEntry[]>(loadHistory)
  const [popularWords, setPopularWords] = useState<DictionaryEntry[]>([])

  // Fallback content for first-time users who have no search history yet.
  useEffect(() => {
    db.dictionary
      .orderBy('frequency_rank')
      .limit(HISTORY_LIMIT)
      .toArray()
      .then(setPopularWords)
      .catch(() => setPopularWords([]))
  }, [])

  const handleSelectEntry = (entry: DictionaryEntry) => {
    setSelectedEntry(entry)
    setHistory((prev) => {
      const next = [entry, ...prev.filter((e) => e.id !== entry.id)].slice(0, HISTORY_LIMIT)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }

  const suggestions = history.length > 0 ? history : popularWords
  const suggestionsLabel = history.length > 0 ? 'Riwayat Pencarian' : 'Kata Populer'

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="eyebrow">Kamus Jerman–Inggris</p>
        <h1 className="page-title text-3xl md:text-4xl mt-1.5">Cari kata, dengar, hafal.</h1>
        <p className="text-sm text-ink-muted mt-1.5">
          Tersimpan offline, pencarian instan. Terjemahan Bahasa Indonesia segera hadir.
        </p>
      </motion.div>

      {/* Floating search bar: fixed just above the bottom tab bar on mobile
          (always reachable regardless of how much content is above it), and
          sticky at the top of the scroll area on desktop so scrolling the
          results never scrolls the search bar away. */}
      <div className="fixed inset-x-0 bottom-20 z-30 px-5 md:sticky md:top-4 md:inset-x-auto md:bottom-auto md:z-20 md:mt-8 md:px-0">
        <SearchBar onSelectEntry={handleSelectEntry} layout="overlay" autoFocus />
      </div>

      <div className="mt-8 pb-40 md:pb-0">
        {selectedEntry ? (
          <motion.div key={selectedEntry.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <button
              onClick={() => setSelectedEntry(null)}
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              <X className="w-4 h-4" /> Tutup
            </button>
            <WordDetail entry={selectedEntry} onAddToDeck={openAddToDeck} />
          </motion.div>
        ) : suggestions.length > 0 ? (
          <div>
            <p className="eyebrow mb-3">{suggestionsLabel}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {suggestions.map((entry) => {
                const isNoun = entry.pos?.toLowerCase() === 'noun'
                const displayLemma = isNoun ? entry.lemma.charAt(0).toUpperCase() + entry.lemma.slice(1) : entry.lemma
                return (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="card p-4 text-left transition-colors hover:bg-surface-muted"
                  >
                    <div className="flex items-baseline flex-wrap gap-1.5">
                      <span className="font-display text-base font-bold text-ink truncate">{displayLemma}</span>
                      {isNoun && entry.gender && (
                        <span className={`badge-gender badge-gender-${entry.gender}`}>
                          {entry.gender === 'm' ? 'der' : entry.gender === 'f' ? 'die' : 'das'}
                        </span>
                      )}
                    </div>
                    {entry.translations && (
                      <p className="text-xs text-ink-faint truncate mt-1">{entry.translations}</p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
