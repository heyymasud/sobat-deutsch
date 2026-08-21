import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom'
import { BookMarked, Layers, Zap, BarChart3, ShieldCheck, Moon, Sun, BookOpen, Menu, X, UserCircle, ChevronRight } from 'lucide-react'
import { db } from '../core/db/dictionaryDb'
import type { Deck } from '../core/db/dictionaryDb'
import { generateCardsForWord } from '../core/srs/srsScheduler'
import { supabase } from '../core/api/supabaseClient'
import { syncEngine } from '../core/sync/syncEngine'
import { SyncIndicator } from '../modules/sync/components/SyncIndicator'
import { SrsSyncIndicator } from '../modules/sync/components/SrsSyncIndicator'
import { Modal } from '../components/Modal'
import type { DictionaryEntry } from '../modules/dictionary/types'

const NAV = [
  { to: '/kamus', label: 'Kamus', Icon: BookMarked },
  { to: '/flashcards', label: 'Flashcards', Icon: Layers },
  { to: '/rush', label: 'Rush', Icon: Zap },
  { to: '/statistik', label: 'Statistik', Icon: BarChart3 },
]

// Statistik lives in the mobile menu drawer instead, to keep the bottom tab bar to 4 slots.
const MOBILE_TAB_NAV = NAV.filter((n) => n.to !== '/statistik')

export interface LayoutContext {
  session: any
  sessionLoaded: boolean
  userRole: string
  openAddToDeck: (entry: DictionaryEntry) => void
}

export const useAppLayout = () => useOutletContext<LayoutContext>()

export default function AppLayout() {
  const navigate = useNavigate()
  const [session, setSession] = useState<any>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [userRole, setUserRole] = useState<string>('student')
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') !== 'light')

  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [entryToAdd, setEntryToAdd] = useState<DictionaryEntry | null>(null)
  const [availableDecks, setAvailableDecks] = useState<Deck[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState<string>('')
  const [addSuccessMsg, setAddSuccessMsg] = useState('')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  async function fetchUserRole(userId: string) {
    try {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
      if (profile) setUserRole(profile.role)
    } catch (err) {
      console.error('Failed to fetch user role:', err)
    }
  }

  // Pull server data on every app start/re-login, not just the first login (S9-xx):
  // otherwise a device that stays logged in across restarts never sees updates
  // pushed from another device until the user manually logs out and back in.
  // Push first so any not-yet-synced local queue items land on the server before
  // the pull clears and rebuilds the local tables from it.
  async function syncOnSessionStart(userId: string) {
    await syncEngine.triggerSync()
    await syncEngine.pullServerData()
    syncEngine.subscribeToRemoteChanges(userId)
    fetchUserRole(userId)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
      if (data.session) {
        syncOnSessionStart(data.session.user.id)
      } else {
        setUserRole('student')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        syncOnSessionStart(session.user.id)
      } else {
        setUserRole('student')
        syncEngine.unsubscribeFromRemoteChanges()
      }
    })

    return () => {
      subscription.unsubscribe()
      syncEngine.unsubscribeFromRemoteChanges()
    }
  }, [])

  const openAddToDeck = async (entry: DictionaryEntry) => {
    setEntryToAdd(entry)
    setAddSuccessMsg('')
    try {
      const decks = await db.decks.toArray()
      setAvailableDecks(decks)
      setSelectedDeckId(decks.length > 0 ? decks[0].id!.toString() : '')
      setShowAddModal(true)
    } catch (err) {
      console.error('Failed to load decks for adding:', err)
    }
  }

  const handleConfirmAddToDeck = async () => {
    if (!entryToAdd || !selectedDeckId) return
    try {
      const deckId = parseInt(selectedDeckId, 10)
      const existing = await db.srsCards
        .where('deckId')
        .equals(deckId)
        .and((c) => c.wordRef === entryToAdd.lemma)
        .first()

      if (existing) {
        alert('Kata ini sudah terdaftar di deck ini!')
        return
      }

      const cards = generateCardsForWord(entryToAdd, deckId)
      await db.transaction('rw', [db.srsCards, db.syncQueue], async () => {
        for (const card of cards) {
          const cardId = await db.srsCards.add(card as any)
          await db.syncQueue.add({
            action: 'insert',
            entityTable: 'srsCards',
            entityData: { id: cardId, ...card },
            queuedAt: Date.now(),
          })
        }
      })
      syncEngine.triggerSync()

      setAddSuccessMsg(`Berhasil menambahkan ${cards.length} kartu ke deck!`)
      setTimeout(() => {
        setShowAddModal(false)
        setEntryToAdd(null)
      }, 1500)
    } catch (err) {
      console.error('Failed to add cards to deck:', err)
      alert('Gagal menambahkan kata ke deck.')
    }
  }

  const context: LayoutContext = { session, sessionLoaded, userRole, openAddToDeck }

  return (
    <div className="min-h-screen bg-canvas text-ink font-body">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-64 shrink-0 bg-surface/60 backdrop-blur-xl border-r border-border px-5 py-7 z-40">
        <NavLink to="/" className="flex items-center gap-2.5 mb-10 px-1 font-display font-extrabold text-lg text-ink">
          <span className="w-9 h-9 rounded-xl bg-ink text-canvas flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </span>
          <span>Sobat<span className="text-brand">Deutsch</span></span>
        </NavLink>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors text-left font-display font-semibold text-sm ${
                  isActive ? 'bg-ink text-canvas' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                }`
              }
            >
              <n.Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2.2} />
              {n.label}
            </NavLink>
          ))}
          {userRole === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors text-left font-display font-semibold text-sm ${
                  isActive ? 'bg-ink text-canvas' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                }`
              }
            >
              <ShieldCheck className="w-[18px] h-[18px] shrink-0" strokeWidth={2.2} />
              Admin
            </NavLink>
          )}
        </nav>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-3 shadow-sm">
            <SyncIndicator />
            <div className="relative pt-2.5">
              <div className="absolute inset-x-0 top-0 border-t border-border" style={{ marginLeft: 42 }} />
              <SrsSyncIndicator />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border p-3">
            <button
              onClick={() => navigate(session ? '/account' : '/login')}
              className="flex items-center gap-2 min-w-0"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                {session ? (session.user?.email?.[0] ?? 'U').toUpperCase() : 'T'}
              </span>
              <span className="leading-tight text-left min-w-0">
                <p className="text-xs font-bold truncate">{session ? 'Akun Saya' : 'Tamu'}</p>
                <p className="text-xs text-ink-faint">{session ? 'Pengaturan' : 'Masuk / Daftar'}</p>
              </span>
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border hover:bg-surface-muted transition-colors"
              aria-label="Ganti tema"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2 font-display font-extrabold text-ink">
          <span className="w-7 h-7 rounded-lg bg-ink text-canvas flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5" />
          </span>
          <span>Sobat<span className="text-brand">Deutsch</span></span>
        </NavLink>
        <div className="flex items-center gap-2">
          <SrsSyncIndicator compact />
        </div>
      </header>

      {/* Main content */}
      <main className="md:pl-64">
        <div className="mx-auto max-w-5xl px-5 py-8 md:px-10 md:py-12 pt-20 md:pt-12 pb-28 md:pb-12">
          <Outlet context={context} />
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-border grid grid-cols-4 px-2 py-2">
        {MOBILE_TAB_NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 rounded-xl py-1.5 transition-colors ${isActive ? 'text-brand' : 'text-ink-faint'}`
            }
          >
            <n.Icon className="w-5 h-5" strokeWidth={2.2} />
            <span className="font-display text-xs font-bold uppercase tracking-wide">{n.label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setShowMobileMenu(true)}
          className="flex flex-col items-center gap-1 rounded-xl py-1.5 text-ink-faint transition-colors"
        >
          <Menu className="w-5 h-5" strokeWidth={2.2} />
          <span className="font-display text-xs font-bold uppercase tracking-wide">Menu</span>
        </button>
      </nav>

      {/* Mobile menu drawer */}
      <AnimatePresence>
        {showMobileMenu && (
          <div className="md:hidden fixed inset-0 z-50 flex items-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowMobileMenu(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 340 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 500) setShowMobileMenu(false)
              }}
              className="relative w-full rounded-t-3xl bg-surface border-t border-border p-5 pb-8 touch-none"
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" />
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-bold text-ink">Menu</h3>
                <button onClick={() => setShowMobileMenu(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface-muted text-ink-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col divide-y divide-border rounded-2xl border border-border overflow-hidden">
                <button
                  onClick={() => {
                    setShowMobileMenu(false)
                    navigate(session ? '/account' : '/login')
                  }}
                  className="flex items-center gap-3 p-3.5 text-left transition-colors hover:bg-surface-muted"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                    {session ? (session.user?.email?.[0] ?? 'U').toUpperCase() : <UserCircle className="w-4 h-4" />}
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <p className="text-sm font-bold text-ink truncate">{session ? 'Akun Saya' : 'Tamu'}</p>
                    <p className="text-xs text-ink-faint">{session ? 'Pengaturan & keluar' : 'Masuk / Daftar'}</p>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                </button>

                <button
                  onClick={() => {
                    setShowMobileMenu(false)
                    navigate('/statistik')
                  }}
                  className="flex items-center gap-3 p-3.5 text-left transition-colors hover:bg-surface-muted"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gender-n/15 text-gender-n">
                    <BarChart3 className="w-4 h-4" />
                  </span>
                  <span className="flex-1 text-sm font-bold text-ink">Statistik</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                </button>

                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="flex items-center gap-3 p-3.5 text-left transition-colors hover:bg-surface-muted"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-muted text-ink-muted">
                    {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </span>
                  <span className="flex-1 text-sm font-bold text-ink">{darkMode ? 'Mode gelap' : 'Mode terang'}</span>
                  <span
                    role="switch"
                    aria-checked={darkMode}
                    aria-label="Ganti tema"
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${darkMode ? 'bg-brand' : 'bg-border'}`}
                  >
                    <motion.span
                      layout
                      transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                      style={{ left: darkMode ? 22 : 2 }}
                    />
                  </span>
                </button>
              </div>

              <div className="mt-3 rounded-2xl bg-surface-muted/60 p-3.5">
                <SyncIndicator />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add To Deck Modal */}
      {showAddModal && (
        <Modal
          title="Tambah ke Deck Flashcard"
          onClose={() => {
            setShowAddModal(false)
            setEntryToAdd(null)
          }}
          footer={
            !addSuccessMsg && (
              <div className="flex gap-2 justify-end text-sm">
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setEntryToAdd(null)
                  }}
                  className="btn-secondary"
                >
                  Batal
                </button>
                <button disabled={availableDecks.length === 0} onClick={handleConfirmAddToDeck} className="btn-primary">
                  Tambah
                </button>
              </div>
            )
          }
        >
          <p className="text-sm text-ink-muted mb-4">
            Pilih deck tujuan untuk mendaftarkan kata <strong className="text-ink">"{entryToAdd?.lemma}"</strong>. Kartu artikel gender & plural akan dibuat otomatis jika relevan.
          </p>

          {addSuccessMsg ? (
            <div className="text-sm font-semibold p-3 rounded-xl border text-success bg-success-soft border-success">
              {addSuccessMsg}
            </div>
          ) : availableDecks.length === 0 ? (
            <div className="text-sm p-3 rounded-xl border text-center text-warning bg-warning-soft border-warning">
              Belum ada deck. Buka <strong>Flashcards</strong> untuk membuat deck terlebih dahulu.
            </div>
          ) : (
            <select className="field-input text-sm" value={selectedDeckId} onChange={(e) => setSelectedDeckId(e.target.value)}>
              {availableDecks.map((deck) => (
                <option key={deck.id} value={deck.id}>{deck.name}</option>
              ))}
            </select>
          )}
        </Modal>
      )}
    </div>
  )
}
