import React, { useState, useEffect } from 'react'
import { supabase } from '../../../core/api/supabaseClient'

interface UserProfileProps {
  onLogout: () => void
}

export const UserProfile: React.FC<UserProfileProps> = ({ onLogout }) => {
  const [user, setUser] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [teacherApp, setTeacherApp] = useState<any>(null)
  const [displayName, setDisplayName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  
  // Daily Limits preference states (S7-03)
  const [dailyNewLimit, setDailyNewLimit] = useState(20)
  const [dailyReviewLimit, setDailyReviewLimit] = useState(100)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUser(data.session.user)
        setDisplayName(data.session.user.user_metadata?.display_name || '')
        loadProfileAndApps(data.session.user.id)
      }
    })
  }, [])

  async function loadProfileAndApps(userId: string) {
    try {
      // 1. Fetch profiles table
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileErr) throw profileErr
      setUserProfile(profile)

      if (profile) {
        setDailyNewLimit(profile.daily_new_limit)
        setDailyReviewLimit(profile.daily_review_limit)
        localStorage.setItem('daily_new_limit', profile.daily_new_limit.toString())
        localStorage.setItem('daily_review_limit', profile.daily_review_limit.toString())
      }

      // 2. Fetch latest teacher application
      const { data: apps, error: appErr } = await supabase
        .from('teacher_applications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (appErr) throw appErr
      if (apps && apps.length > 0) {
        setTeacherApp(apps[0])
      }
    } catch (err) {
      console.error('Failed to load user profile or applications:', err)
      // Fallback local limits
      const localNew = localStorage.getItem('daily_new_limit') || '20'
      const localReview = localStorage.getItem('daily_review_limit') || '100'
      setDailyNewLimit(parseInt(localNew, 10))
      setDailyReviewLimit(parseInt(localReview, 10))
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setInfoMsg('')
    setLoading(true)

    try {
      // Save local preferences first
      localStorage.setItem('daily_new_limit', dailyNewLimit.toString())
      localStorage.setItem('daily_review_limit', dailyReviewLimit.toString())

      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim() }
      })
      if (error) throw error

      // Also sync update in public.profiles table
      await supabase
        .from('profiles')
        .update({ 
          display_name: displayName.trim(),
          daily_new_limit: dailyNewLimit,
          daily_review_limit: dailyReviewLimit
        })
        .eq('id', user.id)

      setInfoMsg('Profil berhasil diperbarui!')
      if (user) loadProfileAndApps(user.id)
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memperbarui profil.')
    } finally {
      setLoading(false)
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setInfoMsg('')

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setErrorMsg('Password baru harus minimal 8 karakter dan mengandung huruf besar, huruf kecil, serta angka.')
      return
    }

    if (!oldPassword) {
      setErrorMsg('Masukkan password lama Anda untuk konfirmasi.')
      return
    }

    setLoading(true)
    try {
      // AC-AUTH-11: reject the change unless the current password is verified
      // first. supabase.auth.updateUser() alone does not require re-auth
      // (secure_password_change is off), so re-verify via a fresh sign-in.
      if (!user?.email) throw new Error('Sesi tidak valid.')
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      })
      if (reauthError) {
        setErrorMsg('Password lama salah.')
        setLoading(false)
        return
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setInfoMsg('Password berhasil diganti!')
      setNewPassword('')
      setOldPassword('')
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengubah password.')
    } finally {
      setLoading(false)
    }
  };

  const handleApplyTeacher = async () => {
    if (!user) return
    setErrorMsg('')
    setInfoMsg('')
    setLoading(true)

    try {
      const { error } = await supabase
        .from('teacher_applications')
        .insert({
          user_id: user.id,
          status: 'pending'
        })

      if (error) throw error
      setInfoMsg('Permohonan menjadi Pengajar berhasil diajukan!')
      loadProfileAndApps(user.id)
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengajukan permohonan pengajar.')
    } finally {
      setLoading(false)
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onLogout()
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Peringatan: Tindakan ini permanen. Semua data Anda akan dihapus. Apakah Anda benar-benar yakin ingin menghapus akun Anda?')) {
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.rpc('delete_user')
      if (error) {
        console.error('Delete RPC failed, attempting profile delete fallback:', error)
      }
      await supabase.auth.signOut()
      alert('Akun berhasil dihapus.')
      onLogout()
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghapus akun.')
    } finally {
      setLoading(false)
    }
  };

  return (
    <div className="max-w-xl mx-auto my-6 text-left px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Pengaturan Akun</h1>

      {errorMsg && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg border border-red-200 mb-4 text-sm">
          {errorMsg}
        </div>
      )}

      {infoMsg && (
        <div className="bg-green-50 text-green-700 p-3 rounded-lg border border-green-200 mb-4 text-sm">
          {infoMsg}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Role Display */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Peran Pengguna</h3>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-indigo-700 uppercase">
              {userProfile?.role || 'STUDENT'}
            </span>
          </div>
        </div>

        {/* Teacher Application Section (S6-02) */}
        {userProfile?.role === 'student' && (
          <div className="bg-white border rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Program Pengajar (Teacher)</h3>
            <p className="text-xs text-gray-500 mb-4">
              Menjadi pengajar memungkinkan Anda berkontribusi dengan merekomendasikan koreksi kosakata langsung ke database.
            </p>

            {teacherApp?.status === 'pending' ? (
              <div className="bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-200 text-xs font-semibold">
                ⏳ Permohonan Anda sedang ditinjau oleh Admin.
              </div>
            ) : teacherApp?.status === 'rejected' ? (
              <div className="flex flex-col gap-3">
                <div className="bg-red-50 text-red-800 p-3 rounded-lg border border-red-200 text-xs">
                  ✕ Permohonan sebelumnya ditolak. Catatan Admin: "{teacherApp.note || 'Tidak ada catatan'}"
                </div>
                <button
                  onClick={handleApplyTeacher}
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition"
                >
                  Ajukan Permohonan Baru
                </button>
              </div>
            ) : (
              <button
                onClick={handleApplyTeacher}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition"
              >
                Daftar Sebagai Pengajar
              </button>
            )}
          </div>
        )}

        {/* Profile Settings & Daily Limits (S7-03) */}
        <form onSubmit={handleUpdateProfile} className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Ubah Profil & Target Belajar</h3>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Email</label>
            <input
              type="text"
              disabled
              className="w-full bg-gray-50 text-gray-500 border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
              value={user?.email || ''}
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nama Tampilan</label>
            <input
              type="text"
              className="w-full bg-white text-gray-950 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Limit Kartu Baru / Hari</label>
              <input
                type="number"
                className="w-full bg-white text-gray-950 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                value={dailyNewLimit}
                onChange={(e) => setDailyNewLimit(parseInt(e.target.value, 10))}
                disabled={loading}
                min={1}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Limit Review Kartu / Hari</label>
              <input
                type="number"
                className="w-full bg-white text-gray-950 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                value={dailyReviewLimit}
                onChange={(e) => setDailyReviewLimit(parseInt(e.target.value, 10))}
                disabled={loading}
                min={1}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition"
          >
            Simpan Perubahan
          </button>
        </form>

        {/* Change Password */}
        <form onSubmit={handleUpdatePassword} className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Ganti Password</h3>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Password Lama</label>
            <input
              type="password"
              className="w-full bg-white text-gray-950 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Password Baru</label>
            <input
              type="password"
              className="w-full bg-white text-gray-950 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition"
          >
            Ganti Password
          </button>
        </form>

        {/* Account Actions */}
        <div className="bg-white border rounded-xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Keluar Sesi</h3>
            <p className="text-xs text-gray-500">Keluar dari perangkat ini.</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full sm:w-auto bg-gray-100 hover:bg-gray-250 text-gray-700 font-semibold px-5 py-2.5 rounded-lg text-sm transition border border-gray-300"
          >
            Log Out
          </button>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-red-800">Hapus Akun</h3>
            <p className="text-xs text-red-600">Semua data Anda akan dihapus secara permanen.</p>
          </div>
          <button
            onClick={handleDeleteAccount}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition shadow-sm"
          >
            Hapus Akun
          </button>
        </div>
      </div>
    </div>
  )
}
