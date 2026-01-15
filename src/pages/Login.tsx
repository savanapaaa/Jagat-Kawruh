import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../lib/api'
import Footer from '../components/Footer'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-amber-50/40 text-slate-900">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <a href="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Jagat Kawruh"
              className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">JAGAT KAWRUH</div>
              <div className="text-[11px] text-slate-600">Media pembelajaran</div>
            </div>
          </a>

          <a href="/" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
            Kembali ke Home
          </a>
        </div>
        <div className="border-b border-slate-200" />
      </header>

      <main className="flex-1">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-2 lg:items-center lg:py-20">
          <div className="text-center">
            <div className="inline-flex justify-center rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
              Halaman Login
            </div>

            <div className="mt-8 flex justify-center">
              <img
                src="/logo.png"
                alt="Jagat Kawruh"
                className="h-20 w-20 shrink-0 object-contain sm:h-24 sm:w-24"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>

            <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-800 sm:text-4xl">
              Masuk ke Jagat Kawruh
            </h1>
          </div>

          <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
            <form
              className="grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setError('')
                setLoading(true)
                
                try {
                  const response = await authAPI.login(email, password)
                  console.log('Login response:', response)
                  
                  if (response.success && response.data) {
                    // Simpan session
                    localStorage.setItem('session', JSON.stringify(response.data.user))
                    
                    // Navigate berdasarkan role
                    const role = response.data.user.role
                    console.log('User role:', role)
                    
                    if (role === 'guru') {
                      console.log('Navigating to guru dashboard')
                      navigate('/guru/dashboard')
                    } else if (role === 'admin') {
                      console.log('Navigating to admin dashboard')
                      navigate('/admin/dashboard')
                    } else if (role === 'siswa') {
                      console.log('Navigating to siswa dashboard')
                      navigate('/siswa/dashboard')
                    } else {
                      console.error('Unknown role:', role)
                      setError('Role tidak dikenali: ' + role)
                    }
                  } else {
                    setError(response.message || 'Login gagal')
                  }
                } catch (err: any) {
                  console.error('Login error:', err)
                  setError(err.message || 'Terjadi kesalahan. Pastikan backend sudah running.')
                } finally {
                  setLoading(false)
                }
              }}
            >
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError('') // Clear error saat user mengetik
                  }}
                  type="email"
                  placeholder="nama@email.com"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <div className="relative mt-2">
                  <input
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-amber-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex items-center justify-center rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Login'}
              </button>

              <div className="mt-2 text-xs text-slate-500">
                Belum punya akun? <span className="font-semibold">(nanti bisa diarahkan ke daftar)</span>
              </div>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
