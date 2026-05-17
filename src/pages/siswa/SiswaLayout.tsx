import { useState, useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { clearSession, getCurrentUser } from '../../lib/auth'
import { hitungNotifikasiBelumDibaca } from '../../lib/idbNotifikasi'
import Footer from '../../components/Footer'

const navItems = [
  { to: '/siswa/dashboard', label: 'Dasbor' },
  { to: '/siswa/materi', label: 'Materi' },
  { to: '/siswa/kuis', label: 'Kuis' },
  { to: '/siswa/pbl', label: 'PBL' },
  { to: '/siswa/nilai', label: 'Nilai' },
  { to: '/siswa/profil', label: 'Profil' },
  { to: '/siswa/panduan', label: 'Panduan' },
]

function NavItem({ to, label, onClick }: { 
  to: string
  label: string
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        [
          'rounded-xl px-3 py-2 text-sm font-semibold transition',
          isActive
            ? 'bg-amber-100 text-amber-800'
            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
        ].join(' ')
      }
    >
      {label}
    </NavLink>
  )
}

export default function SiswaLayout() {
  const user = getCurrentUser()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    const loadNotifCount = async () => {
      if (user?.email) {
        const count = await hitungNotifikasiBelumDibaca(user.email)
        setNotifCount(count)
      }
    }
    loadNotifCount()

    const handler = () => {
      void loadNotifCount()
    }
    window.addEventListener('notifikasi:changed', handler)
    
    // Refresh setiap 30 detik
    const interval = setInterval(loadNotifCount, 30000)
    return () => {
      window.removeEventListener('notifikasi:changed', handler)
      clearInterval(interval)
    }
  }, [user?.email])

  return (
    <div className="flex min-h-screen flex-col bg-amber-50/40 text-slate-900">
      <header className="sticky top-0 z-[60] border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="flex w-full items-center justify-between px-3 py-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden rounded-lg p-2 text-slate-700 hover:bg-slate-100"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <NavLink to="/siswa/dashboard" className="flex items-center gap-3">
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
              <div className="text-[11px] text-slate-600">Area Siswa</div>
            </div>
          </NavLink>

          <div className="flex items-center gap-3">
            <NavLink
              to="/siswa/notifikasi"
              className="relative rounded-lg p-2 text-slate-700 hover:bg-slate-100"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </NavLink>

            <a
              href="/login"
              onClick={() => clearSession()}
              className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            >
              Keluar
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="w-full px-3 py-8 sm:px-4">
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Mobile Menu Overlay */}
            {menuOpen && (
              <div
                className="fixed inset-0 z-[65] bg-black/50 lg:hidden"
                onClick={() => setMenuOpen(false)}
              />
            )}

            {/* Sidebar */}
            <aside className={`
              fixed inset-y-0 left-0 z-[70] w-64 transform transition-transform duration-300 lg:sticky lg:top-24 lg:self-start lg:translate-x-0
              ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
              <div className="h-full overflow-y-auto bg-amber-50/40 p-4 lg:bg-transparent lg:p-0">
                <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <div className="text-xs font-semibold tracking-wide text-slate-500">MENU</div>
                  <nav className="mt-3 flex flex-col gap-2">
                    {navItems.map((item) => (
                      <NavItem 
                        key={item.to} 
                        to={item.to} 
                        label={item.label}
                        onClick={() => setMenuOpen(false)}
                      />
                    ))}
                  </nav>
                </div>
              </div>
            </aside>

            <section className="min-w-0 flex-1">
              <Outlet />
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
