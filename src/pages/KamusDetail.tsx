import { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { WordDetail } from '../modules/dictionary/components/WordDetail'
import { db } from '../core/db/dictionaryDb'
import { supabase } from '../core/api/supabaseClient'
import { useAppLayout } from '../layouts/AppLayout'
import type { DictionaryEntry } from '../modules/dictionary/types'

export default function KamusDetail() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { openAddToDeck } = useAppLayout()

  const stateEntry = (location.state as { entry?: DictionaryEntry } | null)?.entry
  const [entry, setEntry] = useState<DictionaryEntry | null>(stateEntry ?? null)
  const [loading, setLoading] = useState(!stateEntry)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (stateEntry && stateEntry.id === Number(id)) return

    const numericId = Number(id)
    if (!numericId) return

    let cancelled = false
    setLoading(true)
    setErrorMsg('')

    ;(async () => {
      try {
        const local = await db.dictionary.get(numericId)
        if (local) {
          if (!cancelled) setEntry(local)
          return
        }
        const { data, error } = await supabase.from('dictionary').select('*').eq('id', numericId).single()
        if (error) throw error
        if (!cancelled) setEntry(data as DictionaryEntry)
      } catch (err) {
        console.error('Failed to load word detail:', err)
        if (!cancelled) setErrorMsg('Gagal memuat detail kata.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <button
        onClick={() => navigate('/kamus')}
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke kamus
      </button>

      {loading && <div className="text-ink-muted text-sm">Memuat...</div>}
      {!loading && errorMsg && <div className="text-danger text-sm">{errorMsg}</div>}
      {!loading && !errorMsg && !entry && <div className="text-ink-muted text-sm">Kata tidak ditemukan.</div>}
      {!loading && entry && <WordDetail entry={entry} onAddToDeck={openAddToDeck} />}
    </motion.div>
  )
}
