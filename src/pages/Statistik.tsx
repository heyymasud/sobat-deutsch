import { motion } from 'framer-motion'
import { Flame, CheckCircle2, Clock, Target } from 'lucide-react'
import { useSrsStats } from '../modules/srs/hooks/useSrsStats'

const fade = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.5 } }),
}

function Stat({ i, icon: Icon, label, value, sub }: { i: number; icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <motion.div custom={i} variants={fade} initial="hidden" animate="show" className="card p-6">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <Icon className="h-4 w-4 text-brand" />
      </div>
      <p className="stat-figure text-4xl mt-3">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-faint">{sub}</p>}
    </motion.div>
  )
}

export default function Statistik() {
  const stats = useSrsStats()
  const maxCount = Math.max(1, ...stats.weeklyActivity.map((d) => d.count))

  return (
    <div>
      <p className="eyebrow">Progres belajar</p>
      <h1 className="page-title text-3xl md:text-4xl mt-1.5">Statistik</h1>

      {stats.loading ? (
        <p className="text-sm text-ink-muted mt-8">Memuat statistik...</p>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <Stat i={0} icon={CheckCircle2} label="Dipelajari" value={stats.totalStudiedWords} sub="total kosakata" />
            <Stat i={1} icon={Clock} label="Hari ini" value={stats.reviewsToday} sub="kartu direview" />
            <Stat i={2} icon={Flame} label="Streak" value={`${stats.streak}h`} sub="hari berturut-turut" />
            <Stat i={3} icon={Target} label="Kategori dilacak" value={Object.keys(stats.accuracyByPos).length} sub="jenis kata" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <motion.div custom={4} variants={fade} initial="hidden" animate="show" className="card p-6 lg:col-span-2">
              <h3 className="font-display text-lg font-bold">Aktivitas 7 hari</h3>
              <div className="mt-6 flex items-end justify-between gap-2 h-40">
                {stats.weeklyActivity.map((d) => (
                  <div key={d.date} className="flex h-full flex-col items-center justify-end gap-2 flex-1">
                    <div
                      className="w-full rounded-t-lg bg-brand"
                      style={{ height: `${Math.max(6, (d.count / maxCount) * 100)}%` }}
                    />
                    <span className="text-xs text-ink-faint font-semibold uppercase">{d.date}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div custom={5} variants={fade} initial="hidden" animate="show" className="card p-6">
              <h3 className="font-display text-lg font-bold">Akurasi per kategori</h3>
              <div className="mt-4 space-y-3">
                {Object.entries(stats.accuracyByPos).length === 0 && (
                  <p className="text-xs text-ink-faint italic">Belum ada data akurasi.</p>
                )}
                {Object.entries(stats.accuracyByPos).map(([pos, data]) => {
                  const rate = Math.round((data.correct / data.total) * 100)
                  return (
                    <div key={pos}>
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold capitalize">{pos}</span>
                        <span className="stat-figure text-sm">{rate}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </div>

          <motion.div custom={6} variants={fade} initial="hidden" animate="show" className="mt-4 card p-6">
            <h3 className="font-display text-lg font-bold">Kata paling sering salah</h3>
            {stats.mistakeWords.length === 0 ? (
              <p className="mt-4 text-xs text-ink-faint italic">Belum ada data kesalahan.</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {stats.mistakeWords.map((m) => (
                  <div key={m.lemma} className="flex items-center justify-between rounded-2xl bg-surface-muted px-4 py-3">
                    <span className="font-display font-bold">{m.lemma}</span>
                    <span className="flex items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1 text-xs font-bold text-danger">
                      <Target className="h-3 w-3" /> {m.mistakeCount}× salah
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  )
}
