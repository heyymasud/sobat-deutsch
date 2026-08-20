import { useState, useEffect } from 'react'
import { SearchBar } from './modules/dictionary/components/SearchBar'
import { WordDetail } from './modules/dictionary/components/WordDetail'
import { SyncIndicator } from './modules/sync/components/SyncIndicator'
import { DeckManager } from './modules/srs/components/DeckManager'
import { ReviewSession } from './modules/srs/components/ReviewSession'
import { AuthForm } from './modules/auth/components/AuthForm'
import { UserProfile } from './modules/auth/components/UserProfile'
import { ArtikelRush } from './modules/quiz/components/ArtikelRush'
import { AdminConsole } from './modules/admin/components/AdminConsole'
import { indexLocalDictionary } from './core/search/searchService'
import { db } from './core/db/dictionaryDb'
import type { Deck } from './core/db/dictionaryDb'
import { generateCardsForWord } from './core/srs/srsScheduler'
import { supabase } from './core/api/supabaseClient'
import { syncEngine } from './core/sync/syncEngine'
import type { DictionaryEntry } from './modules/dictionary/types'

function App() {
  const [activeTab, setActiveTab] = useState<'kamus' | 'srs' | 'quiz' | 'settings' | 'admin'>('kamus')
  const [selectedEntry, setSelectedEntry] = useState<DictionaryEntry | null>(null)
  
  // Auth state
  const [session, setSession] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('student')
  const [showAuthModal, setShowAuthModal] = useState(false)

  // SRS study state
  const [activeReviewDeckId, setActiveReviewDeckId] = useState<number | null>(null)
  
  // Add to deck modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [entryToAdd, setEntryToAdd] = useState<DictionaryEntry | null>(null)
  const [availableDecks, setAvailableDecks] = useState<Deck[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState<string>('')
  const [addSuccessMsg, setAddSuccessMsg] = useState('')

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  async function fetchUserRole(userId: string) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (profile) {
        setUserRole(profile.role)
      }
    } catch (err) {
      console.error('Failed to fetch user role:', err)
    }
  }

  useEffect(() => {
    // Initialize local dictionary indexing on app mount
    indexLocalDictionary().catch((err) => {
      console.error('Failed to initialize local search index:', err)
    })

    // Listen to Supabase auth events
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        syncEngine.triggerSync()
        fetchUserRole(data.session.user.id)
      } else {
        setUserRole('student')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        syncEngine.triggerSync()
        fetchUserRole(session.user.id)
      } else {
        setUserRole('student')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])



  // Load available decks for the modal
  const openAddToDeck = async (entry: DictionaryEntry) => {
    setEntryToAdd(entry)
    setAddSuccessMsg('')
    try {
      const decks = await db.decks.toArray()
      setAvailableDecks(decks)
      if (decks.length > 0) {
        setSelectedDeckId(decks[0].id!.toString())
      } else {
        setSelectedDeckId('')
      }
      setShowAddModal(true)
    } catch (err) {
      console.error('Failed to load decks for adding:', err)
    }
  };

  const handleConfirmAddToDeck = async () => {
    if (!entryToAdd || !selectedDeckId) return

    try {
      const deckId = parseInt(selectedDeckId, 10)
      
      // Check if card already exists for this word in this deck
      const existing = await db.srsCards
        .where('deckId')
        .equals(deckId)
        .and((c) => c.wordRef === entryToAdd.lemma)
        .first()

      if (existing) {
        alert('Kata ini sudah terdaftar di deck ini!')
        return
      }

      // Generate cards automatically based on grammar rules
      const cards = generateCardsForWord(entryToAdd, deckId)
      
      // Save cards & sync logs
      await db.transaction('rw', [db.srsCards, db.syncQueue], async () => {
        for (const card of cards) {
          const cardId = await db.srsCards.add(card as any)
          await db.syncQueue.add({
            action: 'insert',
            entityTable: 'srsCards',
            entityData: { id: cardId, ...card },
            queuedAt: Date.now()
          })
        }
      })

      // Trigger online sync if authenticated
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
  };

  const handleAuthSuccess = async () => {
    setShowAuthModal(false)
    // Run guest data migration to push local guest data to user account
    await syncEngine.migrateGuestData()
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span 
              onClick={() => {
                setActiveTab('kamus')
                setActiveReviewDeckId(null)
              }}
              className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent cursor-pointer"
            >
              Sobat Deutsch
            </span>
          </div>
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-4">
              <button
                onClick={() => {
                  setActiveTab('kamus')
                  setActiveReviewDeckId(null)
                }}
                className={`text-sm font-semibold transition py-1.5 px-3 rounded-lg ${
                  activeTab === 'kamus' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'
                }`}
              >
                Kamus
              </button>
              <button
                onClick={() => {
                  setActiveTab('srs')
                  setActiveReviewDeckId(null)
                }}
                className={`text-sm font-semibold transition py-1.5 px-3 rounded-lg ${
                  activeTab === 'srs' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'
                }`}
              >
                SRS Flashcard
              </button>
              <button
                onClick={() => {
                  setActiveTab('quiz')
                  setActiveReviewDeckId(null)
                }}
                className={`text-sm font-semibold transition py-1.5 px-3 rounded-lg ${
                  activeTab === 'quiz' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'
                }`}
              >
                Artikel Rush
              </button>

              {userRole === 'admin' && (
                <button
                  onClick={() => {
                    setActiveTab('admin')
                    setActiveReviewDeckId(null)
                  }}
                  className={`text-sm font-semibold transition py-1.5 px-3 rounded-lg ${
                    activeTab === 'admin' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'
                  }`}
                >
                  Panel Admin
                </button>
              )}

              {session ? (
                <button
                  onClick={() => {
                    setActiveTab('settings')
                    setActiveReviewDeckId(null)
                  }}
                  className={`text-sm font-semibold transition py-1.5 px-3 rounded-lg ${
                    activeTab === 'settings' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'
                  }`}
                >
                  Pengaturan
                </button>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition shadow-sm"
                >
                  Masuk / Daftar
                </button>
              )}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="text-lg p-1.5 rounded-lg hover:bg-gray-100 transition"
                title="Ganti Tema"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>
            </nav>
            <SyncIndicator />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 flex flex-col justify-start">
        {activeTab === 'kamus' ? (
          <>
            <div className="text-center my-8">
              <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
                Belajar Bahasa Jerman Lebih Mudah
              </h2>
              <p className="text-lg text-gray-600 max-w-xl mx-auto">
                Cari kata benda dengan artikel gender otomatis, dengarkan pengucapan, dan kuasai kosakata Jerman Anda.
              </p>
            </div>

            {/* Search Component */}
            <div className="w-full mb-6">
              <SearchBar onSelectEntry={setSelectedEntry} />
            </div>

            {/* Detail Component */}
            {selectedEntry ? (
              <div className="mt-4">
                <WordDetail entry={selectedEntry} onAddToDeck={openAddToDeck} />
              </div>
            ) : (
              <div className="mt-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl p-12 max-w-xl mx-auto w-full">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-sm font-medium">Belum ada kata yang dipilih</p>
                <p className="text-xs text-gray-400 mt-1">Gunakan kotak pencarian di atas untuk mulai mencari kosakata.</p>
              </div>
            )}
          </>
        ) : activeTab === 'srs' ? (
          /* SRS Flashcard Tab */
          <div className="w-full mt-4">
            {activeReviewDeckId !== null ? (
              <ReviewSession
                deckId={activeReviewDeckId}
                onFinish={() => setActiveReviewDeckId(null)}
              />
            ) : (
              <DeckManager onStartReview={setActiveReviewDeckId} />
            )}
          </div>
        ) : activeTab === 'quiz' ? (
          /* Artikel Rush Tab */
          <div className="w-full mt-4">
            <ArtikelRush />
          </div>
        ) : activeTab === 'admin' ? (
          /* Admin Console Tab */
          <div className="w-full mt-4">
            <AdminConsole />
          </div>
        ) : (
          /* Settings Tab */
          <div className="w-full mt-4">
            <UserProfile onLogout={() => {
              setActiveTab('kamus')
              setSession(null)
              setUserRole('student')
            }} />
          </div>
        )}
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative max-w-md w-full">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-lg font-bold"
            >
              ✕
            </button>
            <AuthForm onAuthSuccess={handleAuthSuccess} />
          </div>
        </div>
      )}

      {/* Add To Deck Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-left border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Tambah ke Deck Flashcard</h3>
            <p className="text-sm text-gray-500 mb-4">
              Pilih deck tujuan untuk mendaftarkan kata <strong className="text-gray-800">"{entryToAdd?.lemma}"</strong>. Kartu artikel gender & plural akan dibuat otomatis jika relevan.
            </p>
            
            {addSuccessMsg ? (
              <div className="bg-green-50 text-green-700 text-sm font-semibold p-3 rounded-lg border border-green-200 text-center">
                {addSuccessMsg}
              </div>
            ) : (
              <>
                {availableDecks.length === 0 ? (
                  <div className="text-sm text-amber-600 bg-amber-50 p-3 border border-amber-100 rounded-lg mb-4 text-center">
                    Belum ada deck. Buka tab <strong>SRS Flashcard</strong> untuk membuat deck terlebih dahulu.
                  </div>
                ) : (
                  <select
                    className="w-full bg-white text-gray-950 border border-gray-300 rounded-lg p-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                  >
                    {availableDecks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {deck.name}
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex gap-2 justify-end text-sm">
                  <button
                    onClick={() => {
                      setShowAddModal(false)
                      setEntryToAdd(null)
                    }}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-600 transition"
                  >
                    Batal
                  </button>
                  <button
                    disabled={availableDecks.length === 0}
                    onClick={handleConfirmAddToDeck}
                    className={`px-4 py-2 text-white font-semibold rounded-lg transition ${
                      availableDecks.length > 0
                        ? 'bg-indigo-600 hover:bg-indigo-700 shadow-sm'
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Tambah
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 px-6 text-center text-sm text-gray-500">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© 2026 Sobat Deutsch. Hak Cipta Dilindungi.</p>
          <div className="flex gap-4">
            <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer" className="hover:text-indigo-600 transition">
              Lisensi CC BY-SA 3.0
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
