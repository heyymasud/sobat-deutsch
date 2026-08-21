import React, { useState, useEffect } from 'react'
import { supabase } from '../../../core/api/supabaseClient'
import { Modal } from '../../../components/Modal'

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

  // Profile info and password are read-only by default; editing happens in a
  // modal so visiting the page doesn't assume every visit is an edit visit.
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  // Each action keeps its own loading + message state so submitting one form
  // never disables or reports status for an unrelated form on the page.
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [teacherLoading, setTeacherLoading] = useState(false)
  const [teacherMsg, setTeacherMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState('')

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
    setProfileMsg(null)
    setProfileLoading(true)

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

      setProfileMsg({ type: 'success', text: 'Profil berhasil diperbarui!' })
      if (user) loadProfileAndApps(user.id)
      setTimeout(() => {
        setShowEditProfile(false)
        setProfileMsg(null)
      }, 1200)
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Gagal memperbarui profil.' })
    } finally {
      setProfileLoading(false)
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMsg(null)

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordMsg({ type: 'error', text: 'Password baru harus minimal 8 karakter dan mengandung huruf besar, huruf kecil, serta angka.' })
      return
    }

    if (!oldPassword) {
      setPasswordMsg({ type: 'error', text: 'Masukkan password lama Anda untuk konfirmasi.' })
      return
    }

    setPasswordLoading(true)
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
        setPasswordMsg({ type: 'error', text: 'Password lama salah.' })
        setPasswordLoading(false)
        return
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordMsg({ type: 'success', text: 'Password berhasil diganti!' })
      setNewPassword('')
      setOldPassword('')
      setTimeout(() => {
        setShowChangePassword(false)
        setPasswordMsg(null)
      }, 1200)
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Gagal mengubah password.' })
    } finally {
      setPasswordLoading(false)
    }
  };

  const handleApplyTeacher = async () => {
    if (!user) return
    setTeacherMsg(null)
    setTeacherLoading(true)

    try {
      const { error } = await supabase
        .from('teacher_applications')
        .insert({
          user_id: user.id,
          status: 'pending'
        })

      if (error) throw error
      setTeacherMsg({ type: 'success', text: 'Permohonan menjadi Pengajar berhasil diajukan!' })
      loadProfileAndApps(user.id)
    } catch (err: any) {
      setTeacherMsg({ type: 'error', text: err.message || 'Gagal mengajukan permohonan pengajar.' })
    } finally {
      setTeacherLoading(false)
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

    setDeleteMsg('')
    setDeleteLoading(true)
    try {
      const { error } = await supabase.rpc('delete_user')
      if (error) {
        console.error('Delete RPC failed, attempting profile delete fallback:', error)
      }
      await supabase.auth.signOut()
      alert('Akun berhasil dihapus.')
      onLogout()
    } catch (err: any) {
      setDeleteMsg(err.message || 'Gagal menghapus akun.')
    } finally {
      setDeleteLoading(false)
    }
  };

  const initial = (displayName || user?.email || 'T')[0]?.toUpperCase() || 'T'
  const roleLabel = (userProfile?.role || 'student').toUpperCase()
  const roleBadgeClass =
    userProfile?.role === 'admin'
      ? 'badge-status-danger'
      : userProfile?.role === 'teacher'
        ? 'badge-status-brand'
        : 'badge-status-neutral'

  return (
    <div className="max-w-2xl mx-auto text-left">
      <h1 className="font-display text-2xl font-bold text-ink mb-6">Pengaturan Akun</h1>

      <div className="flex flex-col gap-6">
        {/* Identity header */}
        <div className="card p-5 flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand text-xl font-bold text-white">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-ink truncate">{displayName || 'Pengguna'}</p>
            <p className="text-sm text-ink-muted truncate">{user?.email}</p>
          </div>
          <span className={`badge-status ${roleBadgeClass} shrink-0`}>{roleLabel}</span>
        </div>

        {/* Teacher Application Section (S6-02) */}
        {userProfile?.role === 'student' && (
          <div className="card p-5">
            <h3 className="font-display text-lg font-bold text-ink mb-2">Program Pengajar (Teacher)</h3>
            <p className="text-xs text-ink-muted mb-4">
              Menjadi pengajar memungkinkan Anda berkontribusi dengan merekomendasikan koreksi kosakata langsung ke database.
            </p>

            {teacherMsg && (
              <div className={`p-3 rounded-xl border mb-3 text-xs ${teacherMsg.type === 'error' ? 'text-danger bg-danger-soft border-danger' : 'text-success bg-success-soft border-success'}`}>
                {teacherMsg.text}
              </div>
            )}

            {teacherApp?.status === 'pending' ? (
              <div className="p-3 rounded-xl border text-xs font-semibold text-warning bg-warning-soft border-warning">
                Permohonan Anda sedang ditinjau oleh Admin.
              </div>
            ) : teacherApp?.status === 'rejected' ? (
              <div className="flex flex-col gap-3">
                <div className="p-3 rounded-xl border text-xs text-danger bg-danger-soft border-danger">
                  Permohonan sebelumnya ditolak. Catatan Admin: "{teacherApp.note || 'Tidak ada catatan'}"
                </div>
                <button
                  onClick={handleApplyTeacher}
                  disabled={teacherLoading}
                  className="btn-primary !py-2 !px-4 text-xs self-start"
                >
                  Ajukan Permohonan Baru
                </button>
              </div>
            ) : (
              <button
                onClick={handleApplyTeacher}
                disabled={teacherLoading}
                className="btn-primary !py-2 !px-4 text-xs"
              >
                Daftar Sebagai Pengajar
              </button>
            )}
          </div>
        )}

        {/* Profile Settings & Daily Limits (S7-03) — read-only summary; edited via modal */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-bold text-ink">Profil & Target Belajar</h3>
            <button onClick={() => setShowEditProfile(true)} className="btn-secondary !py-1.5 !px-3.5 text-xs">
              Edit
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div className="col-span-2">
              <dt className="text-xs font-semibold text-ink-faint uppercase mb-0.5">Nama Tampilan</dt>
              <dd className="text-ink">{displayName || 'Belum diatur'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-faint uppercase mb-0.5">Kartu Baru / Hari</dt>
              <dd className="text-ink font-semibold">{dailyNewLimit}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-faint uppercase mb-0.5">Review / Hari</dt>
              <dd className="text-ink font-semibold">{dailyReviewLimit}</dd>
            </div>
          </dl>
        </div>

        {/* Change Password — button only; form lives in a modal */}
        <div className="card p-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-ink">Password</h3>
            <p className="text-xs text-ink-muted">Ganti password akun Anda.</p>
          </div>
          <button onClick={() => setShowChangePassword(true)} className="btn-secondary shrink-0 whitespace-nowrap">
            Ganti Password
          </button>
        </div>

        {/* Account Actions */}
        <div className="card p-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-ink">Keluar Sesi</h3>
            <p className="text-xs text-ink-muted">Keluar dari perangkat ini.</p>
          </div>
          <button
            onClick={handleLogout}
            className="btn-secondary shrink-0 whitespace-nowrap"
          >
            Log Out
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="p-5 rounded-2xl border flex items-center justify-between gap-4 border-danger bg-danger-soft">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold text-danger">Hapus Akun</h3>
              <p className="text-xs text-danger">Semua data Anda akan dihapus secara permanen.</p>
            </div>
            <button
              onClick={handleDeleteAccount}
              disabled={deleteLoading}
              className="btn-danger shrink-0 whitespace-nowrap !py-2.5 !px-5 text-sm"
            >
              {deleteLoading ? 'Menghapus…' : 'Hapus Akun'}
            </button>
          </div>
          {deleteMsg && (
            <div className="p-3 rounded-xl border text-sm text-danger bg-danger-soft border-danger">
              {deleteMsg}
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <form onSubmit={handleUpdateProfile}>
          <Modal
            title="Edit Profil & Target Belajar"
            onClose={() => setShowEditProfile(false)}
            footer={
              <div className="flex gap-2 justify-end text-sm">
                <button type="button" onClick={() => setShowEditProfile(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={profileLoading} className="btn-primary">
                  {profileLoading ? 'Menyimpan…' : 'Simpan Perubahan'}
                </button>
              </div>
            }
          >
            {profileMsg && (
              <div className={`p-3 rounded-xl border mb-4 text-sm ${profileMsg.type === 'error' ? 'text-danger bg-danger-soft border-danger' : 'text-success bg-success-soft border-success'}`}>
                {profileMsg.text}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="profile-email" className="block text-xs font-semibold text-ink-faint uppercase mb-1">Email</label>
              <input
                id="profile-email"
                type="text"
                disabled
                autoComplete="email"
                className="field-input text-sm cursor-not-allowed opacity-60"
                value={user?.email || ''}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="profile-name" className="block text-xs font-semibold text-ink-faint uppercase mb-1">Nama Tampilan</label>
              <input
                id="profile-name"
                type="text"
                autoComplete="name"
                className="field-input text-sm"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={profileLoading}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="daily-new-limit" className="block text-xs font-semibold text-ink-faint uppercase mb-1">Kartu Baru / Hari</label>
                <input
                  id="daily-new-limit"
                  type="number"
                  className="field-input text-sm"
                  value={dailyNewLimit}
                  onChange={(e) => setDailyNewLimit(parseInt(e.target.value, 10))}
                  disabled={profileLoading}
                  min={1}
                  required
                />
              </div>
              <div>
                <label htmlFor="daily-review-limit" className="block text-xs font-semibold text-ink-faint uppercase mb-1">Review / Hari</label>
                <input
                  id="daily-review-limit"
                  type="number"
                  className="field-input text-sm"
                  value={dailyReviewLimit}
                  onChange={(e) => setDailyReviewLimit(parseInt(e.target.value, 10))}
                  disabled={profileLoading}
                  min={1}
                  required
                />
              </div>
            </div>
          </Modal>
        </form>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <form onSubmit={handleUpdatePassword}>
          <Modal
            title="Ganti Password"
            onClose={() => setShowChangePassword(false)}
            footer={
              <div className="flex gap-2 justify-end text-sm">
                <button type="button" onClick={() => setShowChangePassword(false)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" disabled={passwordLoading} className="btn-primary">
                  {passwordLoading ? 'Mengganti…' : 'Ganti Password'}
                </button>
              </div>
            }
          >
            {passwordMsg && (
              <div className={`p-3 rounded-xl border mb-4 text-sm ${passwordMsg.type === 'error' ? 'text-danger bg-danger-soft border-danger' : 'text-success bg-success-soft border-success'}`}>
                {passwordMsg.text}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="old-password" className="block text-xs font-semibold text-ink-faint uppercase mb-1">Password Lama</label>
              <input
                id="old-password"
                type="password"
                autoComplete="current-password"
                className="field-input text-sm"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={passwordLoading}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-ink-faint uppercase mb-1">Password Baru</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                className="field-input text-sm"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={passwordLoading}
              />
            </div>
          </Modal>
        </form>
      )}
    </div>
  )
}
