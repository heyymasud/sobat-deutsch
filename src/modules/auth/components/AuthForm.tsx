import React, { useState } from 'react'
import { Mail, Lock, Loader2 } from 'lucide-react'
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
      onAuthSuccess()
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
    <div className="card p-8 max-w-md w-full mx-auto text-left">
      {view !== 'reset' && (
        <div className="pill-toggle mb-6 mx-auto w-fit">
          <button type="button" data-active={view === 'login'} onClick={() => setView('login')}>Masuk</button>
          <button type="button" data-active={view === 'signup'} onClick={() => setView('signup')}>Daftar</button>
        </div>
      )}
      <h2 className="page-title text-2xl mb-6 text-center">
        {view === 'login' ? 'Selamat datang kembali' : view === 'signup' ? 'Buat akun baru' : 'Reset Password'}
      </h2>

      {errorMsg && (
        <div className="p-3 rounded-xl border text-sm mb-4 text-danger bg-danger-soft border-danger">
          {errorMsg}
        </div>
      )}

      {infoMsg && (
        <div className="p-3 rounded-xl border text-sm mb-4 text-success bg-success-soft border-success">
          {infoMsg}
        </div>
      )}

      <form
        onSubmit={
          view === 'login' ? handleLogin : view === 'signup' ? handleSignup : handleResetPassword
        }
        className="flex flex-col gap-4"
      >
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="email"
            className="field-input !pl-11 text-sm"
            placeholder="Alamat email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            aria-label="Alamat email"
            required
          />
        </div>

        {view !== 'reset' && (
          <div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                type="password"
                className="field-input !pl-11 text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                aria-label="Password"
                required
              />
            </div>
            {view === 'signup' && (
              <p className="text-xs text-ink-faint mt-2">
                Minimal 8 karakter, huruf besar, huruf kecil, dan angka.
              </p>
            )}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-sm mt-2 flex items-center justify-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {view === 'login' ? 'Masuk' : view === 'signup' ? 'Daftar' : 'Kirim Tautan'}
        </button>
      </form>

      {/* ponytail: Google OAuth belum dikonfigurasi di Supabase dashboard, sembunyikan sampai disetup */}

      {/* Switch View Controls */}
      <div className="mt-6 pt-4 border-t border-border flex flex-col items-center gap-2 text-xs text-ink-muted">
        {view === 'login' ? (
          <>
            <button onClick={() => setView('signup')} className="text-brand hover:underline">
              Belum punya akun? Daftar gratis
            </button>
            <button onClick={() => setView('reset')} className="text-ink-faint hover:underline">
              Lupa password?
            </button>
          </>
        ) : view === 'signup' ? (
          <button onClick={() => setView('login')} className="text-brand hover:underline">
            Sudah punya akun? Masuk
          </button>
        ) : (
          <button onClick={() => setView('login')} className="text-brand hover:underline">
            Kembali ke Halaman Masuk
          </button>
        )}
      </div>
    </div>
  )
}
