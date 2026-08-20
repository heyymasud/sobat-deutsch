import React, { useState } from 'react'
import { supabase } from '../../../core/api/supabaseClient'

interface AuthFormProps {
  onAuthSuccess: () => void
}

export const AuthForm: React.FC<AuthFormProps> = ({ onAuthSuccess }) => {
  const [view, setView] = useState<'login' | 'signup' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')

  // Server-side login lock (S4-03, BR-AUTH-05). localStorage is kept only as
  // a UI hint to avoid an extra round-trip before the form even renders; the
  // RPC (backed by public.login_attempts, SECURITY DEFINER-only) is the
  // source of truth and is checked/updated on every attempt below.
  const getLoginLockTime = (): number => {
    const lockedUntil = localStorage.getItem('login_locked_until')
    return lockedUntil ? parseInt(lockedUntil, 10) : 0
  };

  const isLoginLocked = (): boolean => {
    return Date.now() < getLoginLockTime()
  };

  const applyLockResult = (locked: boolean, lockedUntil: string | null) => {
    if (locked && lockedUntil) {
      localStorage.setItem('login_locked_until', new Date(lockedUntil).getTime().toString())
      setErrorMsg('Terlalu banyak percobaan login gagal. Pintu masuk dikunci selama 15 menit.')
    } else {
      localStorage.removeItem('login_locked_until')
    }
  };

  // Validations (S4-01)
  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
  };

  const validatePasswordStrength = (val: string) => {
    // Password must be >= 8 chars and contain uppercase, lowercase, and digit
    return val.length >= 8 && /[A-Z]/.test(val) && /[a-z]/.test(val) && /\d/.test(val)
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setInfoMsg('')

    if (isLoginLocked()) {
      const minutesLeft = Math.ceil((getLoginLockTime() - Date.now()) / (60 * 1000))
      setErrorMsg(`Cobalah kembali dalam ${minutesLeft} menit.`)
      return
    }

    if (!email || !password) {
      setErrorMsg('Email dan password harus diisi.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'check_and_record_login_attempt',
        { p_email: email, p_success: !error }
      )
      const lockResult = rpcError ? null : rpcData?.[0]

      if (error) {
        if (lockResult?.locked) {
          applyLockResult(true, lockResult.locked_until)
        } else {
          setErrorMsg('Email atau password salah.')
        }
      } else {
        applyLockResult(false, null)
        onAuthSuccess()
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg('Email atau password salah.')
    } finally {
      setLoading(false)
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('')
    setInfoMsg('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal masuk dengan Google.')
      setLoading(false)
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setInfoMsg('')

    if (!validateEmail(email)) {
      setErrorMsg('Format email tidak valid.')
      return
    }

    if (!validatePasswordStrength(password)) {
      setErrorMsg('Password harus minimal 8 karakter dan mengandung huruf besar, huruf kecil, serta angka.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      setInfoMsg('Registrasi berhasil! Silakan periksa kotak masuk email Anda untuk verifikasi.')
    } catch (err: any) {
      setErrorMsg(err.message || 'Registrasi gagal. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setInfoMsg('')

    if (!validateEmail(email)) {
      setErrorMsg('Format email tidak valid.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) throw error
      setInfoMsg('Tautan reset password telah dikirim ke email Anda.')
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim email reset password.')
    } finally {
      setLoading(false)
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6 max-w-md w-full mx-auto my-12 text-left">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
        {view === 'login' ? 'Masuk ke Akun' : view === 'signup' ? 'Daftar Baru' : 'Reset Password'}
      </h2>

      {errorMsg && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 text-sm mb-4">
          {errorMsg}
        </div>
      )}

      {infoMsg && (
        <div className="bg-green-50 text-green-700 p-3 rounded-lg border border-green-200 text-sm mb-4">
          {infoMsg}
        </div>
      )}

      <form
        onSubmit={
          view === 'login' ? handleLogin : view === 'signup' ? handleSignup : handleResetPassword
        }
        className="flex flex-col gap-4"
      >
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Alamat Email
          </label>
          <input
            type="email"
            className="w-full bg-white text-gray-950 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>

        {view !== 'reset' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              className="w-full bg-white text-gray-950 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
            {view === 'signup' && (
              <p className="text-[10px] text-gray-400 mt-1">
                Minimal 8 karakter, huruf besar, huruf kecil, dan angka.
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition shadow-sm text-sm mt-2 flex items-center justify-center gap-2"
        >
          {loading && (
            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {view === 'login' ? 'Masuk' : view === 'signup' ? 'Daftar' : 'Kirim Tautan'}
        </button>
      </form>

      {view === 'login' && (
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full mt-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-lg border border-gray-300 transition text-sm flex items-center justify-center gap-2"
        >
          Masuk dengan Google
        </button>
      )}

      {/* Switch View Controls */}
      <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col items-center gap-2 text-xs text-gray-500">
        {view === 'login' ? (
          <>
            <button onClick={() => setView('signup')} className="text-indigo-600 hover:underline">
              Belum punya akun? Daftar gratis
            </button>
            <button onClick={() => setView('reset')} className="text-gray-400 hover:underline">
              Lupa password?
            </button>
          </>
        ) : view === 'signup' ? (
          <button onClick={() => setView('login')} className="text-indigo-600 hover:underline">
            Sudah punya akun? Masuk
          </button>
        ) : (
          <button onClick={() => setView('login')} className="text-indigo-600 hover:underline">
            Kembali ke Halaman Masuk
          </button>
        )}
      </div>
    </div>
  )
}
