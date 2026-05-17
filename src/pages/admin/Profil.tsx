import { useState, useEffect } from 'react'
import { getCurrentUser, patchSession } from '../../lib/auth'
import { profileAPI } from '../../lib/api'

export default function AdminProfil() {
  const user = getCurrentUser()
  const [isEditingProfil, setIsEditingProfil] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const [profile, setProfile] = useState<{ nama?: string; email?: string } | null>(null)

  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')

  const [passwordLama, setPasswordLama] = useState('')
  const [passwordBaru, setPasswordBaru] = useState('')
  const [konfirmasiPassword, setKonfirmasiPassword] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      const response = await profileAPI.get()
      if (response.success && response.data) {
        const namaValue = (response.data as any).nama ?? (response.data as any).name ?? ''
        const emailValue = (response.data as any).email ?? ''
        setProfile({ ...(response.data as any), nama: namaValue, email: emailValue })
        setNama(namaValue)
        setEmail(emailValue)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  }

  const handleUpdateProfil = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await profileAPI.update({ nama, email })
      
      if (response.success) {
        alert(response.message || 'Profil berhasil diubah')
        const cleanedNama = nama.trim()
        const cleanedEmail = email.trim()
        patchSession({ nama: cleanedNama, email: cleanedEmail })
        setProfile((prev) => ({ ...(prev ?? {}), nama: cleanedNama, email: cleanedEmail }))
        setNama(cleanedNama)
        setEmail(cleanedEmail)
        setIsEditingProfil(false)
        await loadProfile()
      } else {
        alert('Error: ' + response.message)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const handleGantiPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordBaru !== konfirmasiPassword) {
      alert('Konfirmasi password tidak cocok!')
      return
    }

    if (passwordBaru.length < 6) {
      alert('Password minimal 6 karakter!')
      return
    }

    try {
      const response = await profileAPI.changePassword({
        current_password: passwordLama,
        new_password: passwordBaru,
        new_password_confirmation: passwordBaru
      })
      
      if (response.success) {
        alert(response.message || 'Password berhasil diubah')
        setPasswordLama('')
        setPasswordBaru('')
        setKonfirmasiPassword('')
        setIsChangingPassword(false)
      } else {
        alert('Error: ' + response.message)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="inline-flex rounded-full bg-blue-100 px-4 py-2 text-xs font-semibold text-blue-800">
          Profil Admin
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">Pengaturan Akun</h1>
        <p className="mt-2 text-sm text-slate-600">Manajemen informasi profil dan keamanan akun Anda</p>
      </div>

      {/* Informasi Profil */}
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-800">Informasi Profil</h2>
          {!isEditingProfil && (
            <button
              onClick={() => setIsEditingProfil(true)}
              className="rounded-full bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-600"
            >
              Edit Profil
            </button>
          )}
        </div>

        {!isEditingProfil ? (
          <div className="mt-6 space-y-4">
            <div>
              <div className="text-xs font-semibold text-slate-500">Nama Lengkap</div>
              <div className="mt-1 text-sm text-slate-800">{profile?.nama || user?.nama || '-'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Email</div>
              <div className="mt-1 text-sm text-slate-800">{profile?.email || user?.email || '-'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Role</div>
              <div className="mt-1 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                Admin
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpdateProfil} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Nama Lengkap</label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-full bg-blue-500 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-600"
              >
                Simpan Perubahan
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingProfil(false)
                  setNama(profile?.nama || '')
                  setEmail(profile?.email || '')
                }}
                className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Keamanan Akun */}
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-800">Keamanan Akun</h2>
          {!isChangingPassword && (
            <button
              onClick={() => setIsChangingPassword(true)}
              className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600"
            >
              Ganti Password
            </button>
          )}
        </div>

        {!isChangingPassword ? (
          <div className="mt-6">
            <div className="text-xs font-semibold text-slate-500">Password</div>
            <div className="mt-1 text-sm text-slate-800">••••••••</div>
            <div className="mt-2 text-xs text-slate-500">Terakhir diubah: Belum pernah</div>
          </div>
        ) : (
          <form onSubmit={handleGantiPassword} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Password Lama</label>
              <input
                type="password"
                value={passwordLama}
                onChange={(e) => setPasswordLama(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Password Baru</label>
              <input
                type="password"
                value={passwordBaru}
                onChange={(e) => setPasswordBaru(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                minLength={6}
                required
              />
              <div className="mt-1 text-xs text-slate-500">Minimal 6 karakter</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Konfirmasi Password Baru</label>
              <input
                type="password"
                value={konfirmasiPassword}
                onChange={(e) => setKonfirmasiPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                minLength={6}
                required
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-full bg-amber-500 px-6 py-2 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Update Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsChangingPassword(false)
                  setPasswordLama('')
                  setPasswordBaru('')
                  setKonfirmasiPassword('')
                }}
                className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
