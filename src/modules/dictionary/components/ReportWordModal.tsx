import React, { useState } from 'react'
import { supabase } from '../../../core/api/supabaseClient'
import { Modal } from '../../../components/Modal'

interface ReportWordModalProps {
  wordId: number
  lemma: string
  onClose: () => void
}

// S6-10: lightweight "report this word is wrong" flow for Student/Guest (FR-DICT-16).
// Distinct from the Teacher structured SuggestCorrection flow — free-text only, no field/value.
export const ReportWordModal: React.FC<ReportWordModalProps> = ({ wordId, lemma, onClose }) => {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!note.trim()) {
      setErrorMsg('Tulis dulu apa yang salah pada kata ini.')
      return
    }
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { error } = await supabase.from('word_reports').insert({
        word_id: wordId,
        reporter_id: session?.user.id ?? null,
        note: note.trim(),
      })
      if (error) throw error
      setSuccessMsg('Laporan terkirim. Terima kasih!')
      setTimeout(onClose, 1500)
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim laporan.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Modal
        title="Laporkan kesalahan"
        onClose={onClose}
        footer={
          <div className="flex gap-2 justify-end text-xs">
            <button type="button" onClick={onClose} className="btn-secondary !py-2 !px-4">
              Batal
            </button>
            <button type="submit" disabled={loading} className="btn-primary !py-2 !px-4">
              Kirim Laporan
            </button>
          </div>
        }
      >
        <p className="text-xs text-ink-faint mb-4">
          Ada yang salah pada kata <strong className="text-ink">"{lemma}"</strong>? Beri tahu kami.
        </p>

        {errorMsg && (
          <div className="bg-danger-soft text-danger p-3 rounded-xl border border-danger text-xs mb-4">{errorMsg}</div>
        )}
        {successMsg && (
          <div className="bg-success-soft text-success p-3 rounded-xl border border-success text-xs mb-4">{successMsg}</div>
        )}

        <textarea
          className="w-full field-input text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Jelaskan apa yang menurut Anda salah..."
          rows={4}
          disabled={loading}
          required
        />
      </Modal>
    </form>
  )
}
