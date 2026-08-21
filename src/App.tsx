import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useEffect } from 'react'
import AppLayout from './layouts/AppLayout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Kamus from './pages/Kamus'
import KamusDetail from './pages/KamusDetail'
import Flashcards from './pages/Flashcards'
import Rush from './pages/Rush'
import Statistik from './pages/Statistik'
import Account from './pages/Account'
import Admin from './pages/Admin'
import { indexLocalDictionary } from './core/search/searchService'

function App() {
  useEffect(() => {
    indexLocalDictionary().catch((err) => {
      console.error('Failed to initialize local search index:', err)
    })
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route element={<AppLayout />}>
          <Route path="/kamus" element={<Kamus />} />
          <Route path="/kamus/:id" element={<KamusDetail />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/rush" element={<Rush />} />
          <Route path="/statistik" element={<Statistik />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Routes>
      <Toaster position="top-center" richColors />
    </BrowserRouter>
  )
}

export default App
