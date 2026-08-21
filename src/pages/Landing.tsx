import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight, BookOpen, Zap, Layers, BookMarked, Volume2, Moon, Sun } from 'lucide-react'

const rise = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
}

const GENDER_CHIPS = [
  { article: 'der', bg: 'bg-gender-m', text: 'text-white' },
  { article: 'die', bg: 'bg-gender-f', text: 'text-white' },
  { article: 'das', bg: 'bg-gender-n', text: 'text-white' },
  { article: 'die (pl.)', bg: 'bg-gender-p', text: 'text-ink' },
]

const CHAPTERS = [
  { n: '01', t: 'Gender & plural sulit dihafal', d: 'Setiap kata benda kami tandai dengan warna gender yang konsisten — biru, merah, hijau, kuning — di seluruh aplikasi.', c: 'text-gender-m' },
  { n: '02', t: 'Kata cepat terlupa', d: 'Flashcard dengan Spaced Repetition (SM-2) memunculkan kata tepat sebelum kamu melupakannya.', c: 'text-gender-f' },
  { n: '03', t: 'Deklinasi 4 kasus membingungkan', d: 'Tabel deklinasi & konjugasi otomatis: Präsens, Perfekt, plus matriks Nominativ–Genitiv.', c: 'text-gender-n' },
  { n: '04', t: 'Kamus lama terasa jadul', d: 'Antarmuka ringan, cepat, dan menyenangkan dipakai harian — bukan dokumen akademik yang kaku.', c: 'text-brand' },
]

const HOW_IT_WORKS = [
  { icon: BookMarked, t: 'Cari & dengar', d: 'Autocomplete instan, artikel berwarna, dan pengucapan suara satu ketuk.' },
  { icon: Layers, t: 'Tambah ke deck', d: 'Satu klik dari kamus langsung menjadi flashcard berjadwal.' },
  { icon: Zap, t: 'Uji lewat game', d: 'Artikel Rush melatih refleks der/die/das dengan streak & skor.' },
]

function useLandingTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])
  return { dark, toggle: () => setDark((d) => !d) }
}

function Nav() {
  const { dark, toggle } = useLandingTheme()
  return (
    <header className="fixed top-0 z-50 w-full">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-12">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-canvas"><BookOpen className="h-5 w-5" /></span>
          <span className="font-display text-lg font-extrabold tracking-tight">Sobat<span className="text-brand">Deutsch</span></span>
        </Link>
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={toggle} className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface/70 backdrop-blur hover:bg-surface-muted transition-colors">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link to="/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink sm:block">Masuk</Link>
          <Link to="/kamus" className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-canvas transition-transform hover:scale-[1.03]">Coba gratis</Link>
        </div>
      </div>
    </header>
  )
}

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-canvas text-ink">
      <Nav />

      {/* HERO */}
      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 pb-16 pt-32 md:px-12">
        <div className="pointer-events-none absolute right-[6%] top-[22%] hidden h-40 w-40 rounded-full bg-gender-m/20 blur-2xl md:block" />
        <div className="pointer-events-none absolute right-[26%] top-[55%] hidden h-28 w-28 rounded-full bg-gender-f/20 blur-2xl md:block" />
        <div className="pointer-events-none absolute right-[14%] top-[40%] hidden h-24 w-24 rounded-full bg-gender-n/20 blur-2xl md:block" />

        <motion.div initial="hidden" animate="show" variants={rise}
          className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 eyebrow">
          <span className="h-1.5 w-1.5 rounded-full bg-gender-n" /> Belajar Jerman · offline-first
        </motion.div>

        <motion.h1 initial="hidden" animate="show" variants={rise} transition={{ delay: 0.1 }}
          className="page-title text-6xl md:text-8xl">
          Kuasai <span className="text-gender-m">der</span>,<br />
          <span className="text-gender-f">die</span>, <span className="text-gender-n">das</span> — tanpa tebak.
        </motion.h1>

        <motion.p initial="hidden" animate="show" variants={rise} transition={{ delay: 0.25 }}
          className="mt-8 max-w-xl text-lg leading-relaxed text-ink-muted md:text-xl">
          Kamus cerdas, flashcard berjadwal, dan mini-game artikel dalam satu aplikasi ringan. Warna gender konsisten di setiap kata — supaya artikel melekat, bukan sekadar dihafal.
        </motion.p>

        <motion.div initial="hidden" animate="show" variants={rise} transition={{ delay: 0.4 }}
          className="mt-10 flex flex-wrap items-center gap-4">
          <Link to="/kamus" className="group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-4 text-base font-bold text-canvas transition-transform hover:scale-[1.03]">
            Mulai belajar <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link to="/rush" className="inline-flex items-center gap-2 rounded-full border border-border px-7 py-4 text-base font-bold hover:bg-surface-muted transition-colors">
            <Zap className="h-5 w-5 text-gender-p" /> Main Artikel Rush
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }}
          className="mt-14 flex flex-wrap gap-3">
          {GENDER_CHIPS.map((g) => (
            <span key={g.article} className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${g.bg} ${g.text}`}>
              {g.article}
            </span>
          ))}
        </motion.div>
      </section>

      {/* MANIFESTO CHAPTERS */}
      <section className="mx-auto max-w-7xl px-6 py-28 md:px-12">
        <motion.h2 initial="hidden" whileInView="show" viewport={{ once: true }} variants={rise}
          className="mb-16 max-w-2xl page-title text-3xl md:text-5xl">
          Empat masalah nyata pembelajar A1–B1. Satu aplikasi yang menjawabnya.
        </motion.h2>
        <div className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-2">
          {CHAPTERS.map((ch, i) => (
            <motion.div key={ch.n} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="bg-canvas p-8 transition-colors hover:bg-surface-muted md:p-12">
              <span className={`font-display text-sm font-bold ${ch.c}`}>{ch.n}</span>
              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight">{ch.t}</h3>
              <p className="mt-3 max-w-md leading-relaxed text-ink-muted">{ch.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-6 pb-28 md:px-12">
        <p className="eyebrow mb-3">Cara kerjanya</p>
        <h2 className="page-title text-3xl md:text-4xl mb-10">Dari cari kata ke hafal — dalam dua klik.</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {HOW_IT_WORKS.map((f) => (
            <motion.div key={f.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-muted"><f.icon className="h-5 w-5" /></span>
              <div>
                <h4 className="font-display text-lg font-bold">{f.t}</h4>
                <p className="text-ink-muted">{f.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel()
              const utterance = new SpeechSynthesisUtterance('der Tisch')
              utterance.lang = 'de-DE'
              window.speechSynthesis.speak(utterance)
            }
          }}
          className="mt-12 flex items-center gap-3 rounded-2xl border border-border p-4 w-fit text-left transition-colors hover:bg-surface-muted"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gender-m text-white"><Volume2 className="h-5 w-5" /></span>
          <div>
            <p className="font-display text-lg font-bold">der Tisch</p>
            <p className="text-xs text-ink-muted">meja · maskulin</p>
          </div>
        </button>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-28 md:px-12">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-ink px-8 py-16 text-center text-canvas md:py-24">
          <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-gender-m/40 blur-3xl" />
          <div className="pointer-events-none absolute right-0 bottom-0 h-40 w-40 rounded-full bg-gender-f/40 blur-3xl" />
          <h2 className="relative page-title !text-canvas text-4xl md:text-6xl">Siap fasih tanpa salah artikel?</h2>
          <p className="relative mx-auto mt-5 max-w-lg text-lg text-canvas/70">Mulai sebagai tamu — tanpa daftar. Progresmu tersimpan lokal, langsung bisa dipakai.</p>
          <Link to="/kamus" className="relative mt-9 inline-flex items-center gap-2 rounded-full bg-canvas px-8 py-4 text-base font-bold text-ink transition-transform hover:scale-[1.03]">
            Buka aplikasi <ArrowUpRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-ink-muted md:flex-row md:px-12">
          <p>Data kamus berlisensi CC BY-SA (Wiktionary/kaikki.org).</p>
          <div className="flex gap-6">
            <Link to="/kamus" className="hover:text-ink">Kamus</Link>
            <Link to="/statistik" className="hover:text-ink">Statistik</Link>
            <Link to="/login" className="hover:text-ink">Masuk</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
