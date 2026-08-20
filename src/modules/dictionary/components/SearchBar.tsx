import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../core/api/supabaseClient'
import { db } from '../../../core/db/dictionaryDb'
import { searchDictionary } from '../../../core/search/searchService'
import type { DictionaryEntry } from '../types'

interface SearchBarProps {
  onSelectEntry: (entry: DictionaryEntry) => void
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSelectEntry }) => {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Partial<DictionaryEntry>[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debouncing search suggestions
  useEffect(() => {
    const handler = setTimeout(async () => {
      const trimmedQuery = query.trim()
      if (trimmedQuery.length < 2) {
        setSuggestions([])
        setIsOpen(false)
        return
      }

      setLoading(true)
      setErrorMsg('')
      try {
        const list = await searchDictionary(trimmedQuery)
        setSuggestions(list)
        setIsOpen(list.length > 0)
      } catch (err: any) {
        console.error('Search error:', err)
        setErrorMsg('Gagal memuat hasil pencarian.')
      } finally {
        setLoading(false)
      }
    }, 250) // 250ms debounce

    return () => clearTimeout(handler)
  }, [query])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = async (id: number) => {
    setIsOpen(false)
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
        return <span className="text-xs font-bold text-gender-m ml-2">der</span>
      case 'f':
        return <span className="text-xs font-bold text-gender-f ml-2">die</span>
      case 'n':
        return <span className="text-xs font-bold text-gender-n ml-2">das</span>
      default:
        return null
    }
  };

  return (
    <div className="relative w-full max-w-xl mx-auto my-4" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg py-3 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
          placeholder="Cari kata Jerman atau terjemahan..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Cari kata Jerman"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="text-sm text-red-500 mt-1.5 px-1">{errorMsg}</div>
      )}

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-60 overflow-y-auto divide-y divide-gray-100">
          {suggestions.map((entry) => {
            const isNoun = entry.pos?.toLowerCase() === 'noun'
            const displayLemma = isNoun
              ? entry.lemma!.charAt(0).toUpperCase() + entry.lemma!.slice(1)
              : entry.lemma!

            return (
              <li
                key={entry.id}
                onClick={() => handleSelect(entry.id!)}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer transition text-left"
              >
                <div className="flex items-baseline flex-1 min-w-0">
                  <span className="font-semibold text-gray-900 truncate">{displayLemma}</span>
                  {entry.pos === 'noun' && getGenderBadge(entry.gender || null)}
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-2 uppercase">
                    {entry.pos}
                  </span>
                  {entry.level && (
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded ml-2 font-medium">
                      {entry.level}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 truncate max-w-[50%] ml-4">
                  {entry.translations}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
