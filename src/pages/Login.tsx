import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { AuthForm } from '../modules/auth/components/AuthForm'
import { syncEngine } from '../core/sync/syncEngine'

export default function Login() {
  const navigate = useNavigate()

  const handleAuthSuccess = async () => {
    await syncEngine.migrateGuestData()
    navigate('/kamus')
  }

  return (
    <div className="relative grid min-h-screen bg-canvas lg:grid-cols-2">
      {/* left visual */}
      <div className="relative hidden overflow-hidden bg-ink p-12 text-canvas lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-10 top-10 h-56 w-56 rounded-full bg-gender-m/30 blur-3xl" />
        <div className="pointer-events-none absolute left-10 bottom-20 h-40 w-40 rounded-full bg-gender-f/30 blur-3xl" />
        <Link to="/" className="relative flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-canvas text-ink"><Sparkles className="h-5 w-5" /></span>
          <span className="font-display text-lg font-extrabold">Sobat Deutsch</span>
        </Link>
        <div className="relative">
          <h2 className="page-title !text-canvas text-5xl leading-tight">
            Simpan <span className="text-gender-m">progres</span>, sinkron di <span className="text-gender-n">semua</span> perangkat.
          </h2>
          <p className="mt-6 max-w-sm text-canvas/70">Daftar hanya untuk sinkronisasi & keamanan data — fitur inti tetap gratis tanpa akun.</p>
        </div>
        <p className="relative text-xs text-canvas/50">Kamu tetap bisa memakai aplikasi sebagai tamu.</p>
      </div>

      {/* form */}
      <div className="flex items-center justify-center px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-sm">
          <Link to="/kamus" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Lanjut sebagai tamu
          </Link>
          <AuthForm onAuthSuccess={handleAuthSuccess} />
        </motion.div>
      </div>
    </div>
  )
}
