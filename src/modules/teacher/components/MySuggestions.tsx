import React, { useState, useEffect } from 'react'
import { supabase } from '../../../core/api/supabaseClient'

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-warning-soft text-warning border-warning',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-danger-soft text-danger border-danger',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

export const MySuggestions: React.FC = () => {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        if (!cancelled) setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from('dictionary_suggestions')
        .select('*, dictionary(lemma, pos)')
        .eq('proposed_by', session.user.id)
        .order('created_at', { ascending: false })
      if (!cancelled) {
        if (error) console.error('Failed to load my suggestions:', error)
        setSuggestions(data || [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="text-sm text-ink-muted py-6 text-center">Memuat riwayat usulan...</div>

  if (suggestions.length === 0) {
    return (
      <div className="text-sm text-ink-faint italic text-center py-8 bg-surface border border-dashed rounded-xl">
        Anda belum pernah mengajukan usulan koreksi kata.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {suggestions.map((s) => {
        const lemma = s.dictionary?.lemma
        const displayLemma = lemma ? lemma.charAt(0).toUpperCase() + lemma.slice(1) : '(kata dihapus)'
        return (
          <div key={s.id} className="card p-5 flex flex-col gap-2 text-left">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-ink text-sm">
                  {displayLemma} <span className="text-xs font-semibold text-ink-faint">({s.dictionary?.pos?.toUpperCase()})</span>
                </h3>
                <p className="text-xs text-ink-faint">{new Date(s.created_at).toLocaleString()}</p>
              </div>
              <span className={`text-xs uppercase font-bold tracking-wider px-2 py-0.5 border rounded-full ${STATUS_STYLE[s.status] || STATUS_STYLE.pending}`}>
                {STATUS_LABEL[s.status] || s.status}
              </span>
            </div>
            <div className="text-xs bg-surface-muted p-2 rounded border border-border">
              <span className="text-ink-muted font-semibold uppercase">{s.field_name}: </span>
              <span className="text-ink italic">"{s.suggested_value || '(kosong)'}"</span>
            </div>
            {s.status === 'rejected' && s.note && (
              <div className="text-xs bg-danger-soft text-danger p-2 rounded border border-red-100">
                <span className="font-semibold">Alasan penolakan: </span>{s.note}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
