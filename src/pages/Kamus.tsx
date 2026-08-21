import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SearchBar } from '../modules/dictionary/components/SearchBar'
import type { DictionaryEntry } from '../modules/dictionary/types'

export default function Kamus() {
  const navigate = useNavigate()

  const handleSelectEntry = (entry: DictionaryEntry) => {
    navigate(`/kamus/${entry.id}`, { state: { entry } })
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="eyebrow">Kamus Jerman–Indonesia</p>
        <h1 className="page-title text-3xl md:text-4xl mt-1.5">Cari kata, dengar, hafal.</h1>
        <p className="text-sm text-ink-muted mt-1.5">Tersimpan offline, pencarian lokal &lt;100ms.</p>
      </motion.div>

      <div className="mt-8 card overflow-hidden h-[70vh] min-h-[420px]">
        <SearchBar onSelectEntry={handleSelectEntry} layout="rail" selectedId={null} autoFocus />
      </div>
    </div>
  )
}
