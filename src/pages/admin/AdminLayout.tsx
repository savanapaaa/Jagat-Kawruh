import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { clearSession } from '../../lib/auth'
import Footer from '../../components/Footer'

const navItems = [
  { to: '/admin/dashboard', label: 'Dasbor' },
  { to: '/admin/guru', label: 'Guru' },
  { to: '/admin/siswa', label: 'Siswa' },
  { to: '/admin/kelas', label: 'Kelas' },
  { to: '/admin/jurusan', label: 'Jurusan' },
  { to: '/admin/profil', label: 'Profil' },
]

function NavItem({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
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

export default function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

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

          <NavLink to="/admin/dashboard" className="flex items-center gap-3">
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
              <div className="text-[11px] text-slate-600">Area Admin</div>
            </div>
          </NavLink>

          <a
            href="/login"
            onClick={() => clearSession()}
            className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            Keluar
          </a>
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
