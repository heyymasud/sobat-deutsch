import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../core/api/supabaseClient'
import { db } from '../../../core/db/dictionaryDb'
import { searchDictionary } from '../../../core/search/searchService'
import { syncManager } from '../../../core/dictSync/syncManager'
import type { SyncStatus } from '../../../core/dictSync/syncManager'
import type { DictionaryEntry } from '../types'

interface SearchBarProps {
  onSelectEntry: (entry: DictionaryEntry) => void
  /** 'overlay' = classic floating dropdown (used on mobile, single-column).
   *  'rail' = persistent inline results list for the desktop split-pane layout. */
  layout?: 'overlay' | 'rail'
  selectedId?: number | null
  autoFocus?: boolean
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSelectEntry, layout = 'overlay', selectedId = null, autoFocus = false }) => {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Partial<DictionaryEntry>[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // FR-DICT-02f: surface the first-time offline sync state right at the
  // search input, not just in the sidebar SyncIndicator — this is exactly
  // where a new user notices "search feels broken" if it's silent.
  useEffect(() => {
    return syncManager.subscribe(setSyncStatus)
  }, [])

  const isFirstTimeSyncing =
    !!syncStatus &&
    syncStatus.localVersion === 0 &&
    (syncStatus.downloadState === 'downloading' || syncStatus.downloadState === 'verifying')

  // Debouncing search suggestions
  useEffect(() => {
    const handler = setTimeout(async () => {
      const trimmedQuery = query.trim()
      if (trimmedQuery.length < 2) {
        setSuggestions([])
        setIsOpen(false)
        setHasSearched(false)
        return
      }

      setLoading(true)
      setErrorMsg('')
      try {
        const list = await searchDictionary(trimmedQuery)
        setSuggestions(list)
        setIsOpen(list.length > 0)
        setHasSearched(true)
      } catch (err: any) {
        console.error('Search error:', err)
        setErrorMsg('Gagal memuat hasil pencarian.')
      } finally {
        setLoading(false)
      }
    }, 250) // 250ms debounce

    return () => clearTimeout(handler)
  }, [query])

  // Close dropdown on click outside (overlay layout only)
  useEffect(() => {
    if (layout !== 'overlay') return
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [layout])

  const handleSelect = async (id: number) => {
    if (layout === 'overlay') setIsOpen(false)
    setLoading(true)
    try {
      // 1. Fetch from local Dexie database if available
      const meta = await db.dictSyncMeta.toCollection().first()
      if (meta && meta.localVersion > 0) {
        const localEntry = await db.dictionary.get(id)
        if (localEntry) {
          onSelectEntry(localEntry)
          return
        }
      }

      // 2. Fallback: Fetch full details of the entry from server
      const { data, error } = await supabase
        .from('dictionary')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        throw error
      }

      if (data) {
        onSelectEntry(data as DictionaryEntry)
      }
    } catch (err: any) {
      console.error('Detail fetch error:', err)
      setErrorMsg('Gagal memuat detail kata.')
    } finally {
      setLoading(false)
    }
  };

  const getGenderBadge = (gender: string | null) => {
    switch (gender) {
      case 'm':
        return <span className="badge-gender badge-gender-m ml-1">der</span>
      case 'f':
        return <span className="badge-gender badge-gender-f ml-1">die</span>
      case 'n':
        return <span className="badge-gender badge-gender-n ml-1">das</span>
      default:
        return null
    }
  };

  const renderRow = (entry: Partial<DictionaryEntry>, index: number) => {
    const isNoun = entry.pos?.toLowerCase() === 'noun'
    const displayLemma = isNoun
      ? entry.lemma!.charAt(0).toUpperCase() + entry.lemma!.slice(1)
      : entry.lemma!
    const isActive = layout === 'rail' && selectedId === entry.id

    const genderVar = entry.gender === 'm' ? 'var(--color-gender-m)' : entry.gender === 'f' ? 'var(--color-gender-f)' : entry.gender === 'n' ? 'var(--color-gender-n)' : 'transparent'

    return (
      <li
        key={entry.id ?? index}
        onClick={() => handleSelect(entry.id!)}
        className={`list-row relative flex items-center gap-3 pl-6 pr-5 py-3.5 cursor-pointer text-left ${
          isActive ? 'bg-brand-soft' : ''
        }`}
      >
        <span
          className="absolute inset-y-0 left-0 w-1 rounded-r"
          style={{ backgroundColor: genderVar === 'transparent' ? 'transparent' : genderVar }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline flex-wrap gap-1.5">
            <span className={`font-display text-[1.05rem] font-bold truncate ${isActive ? 'text-brand' : 'text-ink'}`}>{displayLemma}</span>
            {entry.pos === 'noun' && getGenderBadge(entry.gender || null)}
          </div>
          <div className="text-xs text-ink-faint truncate mt-0.5">{entry.translations}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="badge">{entry.pos}</span>
          {entry.level && <span className="badge text-brand border-brand">{entry.level}</span>}
        </div>
      </li>
    )
  }

  const input = (
    <div className="relative">
      <svg className="absolute inset-y-0 left-5 my-auto h-5 w-5 text-ink-faint pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        className="field-input !rounded-2xl !pl-12 !pr-10 !py-4 text-base"
        placeholder="Cari kata Jerman atau terjemahan..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Cari kata Jerman"
        autoFocus={autoFocus}
      />
      {loading && (
        <svg className="absolute inset-y-0 right-4 my-auto h-4 w-4 animate-spin text-ink-faint" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
    </div>
  )

  const syncingHint = isFirstTimeSyncing && (
    <p className="text-xs text-ink-faint px-1">
      Menyiapkan kamus offline ({syncStatus!.downloadProgress}%) — pencarian pakai mode online untuk sekarang.
    </p>
  )

  if (layout === 'rail') {
    return (
      <div className="flex flex-col h-full min-h-0" ref={dropdownRef}>
        <div className="p-5 shrink-0 flex flex-col gap-2">
          {input}
          {syncingHint}
        </div>
        {errorMsg && (
          <div className="text-sm px-5 py-2 text-danger">{errorMsg}</div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto border-t border-border">
          {suggestions.length > 0 ? (
            <ul className="divide-y divide-border">{suggestions.map((entry, i) => renderRow(entry, i))}</ul>
          ) : hasSearched ? (
            <p className="text-sm text-ink-faint text-center py-10 px-5">Tidak ada hasil untuk "{query}".</p>
          ) : (
            <p className="text-sm text-ink-faint text-center py-10 px-5">
              Ketik minimal 2 huruf untuk mencari di 110.894 lema.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {input}
      {syncingHint && <div className="mt-1.5">{syncingHint}</div>}

      {errorMsg && (
        <div className="text-sm mt-1.5 px-1 text-danger">{errorMsg}</div>
      )}

      {/* Autocomplete Dropdown (mobile / single-column) */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full card mt-1 max-h-72 overflow-y-auto divide-y divide-border shadow-lg">
          {suggestions.map((entry, i) => renderRow(entry, i))}
        </ul>
      )}
    </div>
  )
}
