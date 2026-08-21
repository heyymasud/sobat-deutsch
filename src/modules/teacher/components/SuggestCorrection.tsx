import React, { useState } from 'react'
import { supabase } from '../../../core/api/supabaseClient'
import type { DictionaryEntry } from '../../dictionary/types'

interface SuggestCorrectionProps {
  entry: DictionaryEntry
  onClose: () => void
}

export const SuggestCorrection: React.FC<SuggestCorrectionProps> = ({ entry, onClose }) => {
  const [translations, setTranslations] = useState(entry.translations || '')
  const [gender, setGender] = useState(entry.gender || '')
  const [plural, setPlural] = useState(entry.plural || '')
  const [example, setExample] = useState(entry.example || '')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const isNoun = entry.pos?.toLowerCase() === 'noun'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!reason.trim()) {
      setErrorMsg('Alasan koreksi wajib diisi.')
      return
    }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Silakan masuk terlebih dahulu.')

      const suggestionsToInsert = []

      const currentTranslations = entry.translations || ''
      if (translations.trim() !== currentTranslations.trim()) {
        suggestionsToInsert.push({ field_name: 'translations', suggested_value: translations.trim() })
      }

      if (isNoun) {
        const currentGender = entry.gender || ''
        const targetGender = gender || ''
        if (targetGender !== currentGender) {
          suggestionsToInsert.push({ field_name: 'gender', suggested_value: gender || null })
        }

        const currentPlural = entry.plural || ''
        const targetPlural = plural.trim() || ''
        if (targetPlural !== currentPlural) {
          suggestionsToInsert.push({ field_name: 'plural', suggested_value: plural.trim() || null })
        }
      }

      const currentExample = entry.example || ''
      if (example.trim() !== currentExample.trim()) {
        suggestionsToInsert.push({ field_name: 'example', suggested_value: example.trim() || null })
      }

      if (suggestionsToInsert.length === 0) {
        throw new Error('Tidak ada perubahan yang diusulkan.')
      }

      for (const sug of suggestionsToInsert) {
        const { error } = await supabase
          .from('dictionary_suggestions')
          .insert({
            word_id: entry.id,
            proposed_by: session.user.id,
            field_name: sug.field_name,
            suggested_value: sug.suggested_value,
            reason_for_change: reason.trim()
          });

        if (error) {
          if (error.code === '23505') {
            throw new Error(`Anda sudah memiliki usulan koreksi yang sedang pending untuk kolom "${sug.field_name}" kata ini.`)
          }
          throw error
        }
      }

      setSuccessMsg('Koreksi berhasil diajukan! Menunggu peninjauan admin.')
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengajukan usulan koreksi.')
    } finally {
      setLoading(false)
    }
  };

  return (
    <div className="bg-surface border rounded-2xl p-6 text-left max-w-lg w-full mx-auto my-4 shadow-lg">
      <h2 className="text-xl font-bold text-ink mb-4">Ajukan Koreksi Kata</h2>
      <p className="text-xs text-ink-faint mb-4">
        Usulkan perubahan makna atau tata bahasa untuk kata <strong className="text-ink">"{entry.lemma}"</strong>.
      </p>

      {errorMsg && (
        <div className="bg-danger-soft text-danger p-3 rounded-xl border border-danger text-xs mb-4">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="bg-success-soft text-success p-3 rounded-xl border border-success text-xs mb-4">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Terjemahan</label>
          <textarea
            className="w-full field-input text-xs"
            value={translations}
            onChange={(e) => setTranslations(e.target.value)}
            disabled={loading}
            rows={2}
            required
          />
        </div>

        {isNoun && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Gender</label>
              <select
                className="w-full field-input text-xs"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={loading}
              >
                <option value="">(Tanpa gender)</option>
                <option value="m">der (maskulin)</option>
                <option value="f">die (feminin)</option>
                <option value="n">das (netral)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Plural</label>
              <input
                type="text"
                className="w-full field-input text-xs"
                value={plural}
                onChange={(e) => setPlural(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Kalimat Contoh</label>
          <textarea
            className="w-full field-input text-xs"
            value={example}
            onChange={(e) => setExample(e.target.value)}
            disabled={loading}
            rows={2}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-muted uppercase mb-1">Alasan Koreksi (Wajib)</label>
          <textarea
            className="w-full field-input text-xs"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tulis alasan atau referensi mengapa informasi kata ini salah..."
            disabled={loading}
            rows={3}
            required
          />
        </div>

        <div className="flex gap-2 justify-end mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-xl hover:bg-surface-muted text-ink-muted transition text-xs"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary text-xs"
          >
            Ajukan Koreksi
          </button>
        </div>
      </form>
    </div>
  )
}
