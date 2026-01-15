import { useEffect, useState } from 'react'
import { getCurrentUser } from '../../lib/auth'
import { 
  semuaNotifikasi, 
  tandaiBaca, 
  tandaiSemuaBaca, 
  hapusNotifikasi,
  type Notifikasi 
} from '../../lib/idbNotifikasi'

export default function SiswaNotifikasi() {
  const user = getCurrentUser()
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'semua' | 'belum-dibaca' | 'sudah-dibaca'>('semua')

  const loadNotifikasi = async () => {
    setLoading(true)
    try {
      const data = await semuaNotifikasi(user?.email)
      setNotifikasi(data)
    } catch (error) {
      console.error('Error loading notifikasi:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotifikasi()
  }, [user?.email])

  const handleTandaiBaca = async (id: string) => {
    await tandaiBaca(id)
    loadNotifikasi()
  }

  const handleTandaiSemuaBaca = async () => {
    await tandaiSemuaBaca(user?.email)
    loadNotifikasi()
  }

  const handleHapus = async (id: string) => {
    if (confirm('Hapus notifikasi ini?')) {
      await hapusNotifikasi(id)
      loadNotifikasi()
    }
  }

  const getIcon = (tipe: string) => {
    switch (tipe) {
      case 'materi':
        return '📚'
      case 'kuis':
        return '📝'
      case 'pbl':
        return '🎯'
      case 'nilai':
        return '📊'
      default:
        return '📢'
    }
  }

  const getColor = (tipe: string) => {
    switch (tipe) {
      case 'materi':
        return 'bg-blue-100 text-blue-800'
      case 'kuis':
        return 'bg-purple-100 text-purple-800'
      case 'pbl':
        return 'bg-emerald-100 text-emerald-800'
      case 'nilai':
        return 'bg-amber-100 text-amber-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  const formatWaktu = (iso: string) => {
    const date = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Baru saja'
    if (minutes < 60) return `${minutes} menit yang lalu`
    if (hours < 24) return `${hours} jam yang lalu`
    if (days < 7) return `${days} hari yang lalu`
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const notifikasiFiltered = notifikasi.filter((n) => {
    if (filter === 'belum-dibaca') return !n.dibaca
    if (filter === 'sudah-dibaca') return n.dibaca
    return true
  })

  const belumDibacaCount = notifikasi.filter(n => !n.dibaca).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex rounded-full bg-emerald-100 px-4 py-2 text-xs font-semibold text-emerald-800">
              🔔 Notifikasi
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
              Pusat Notifikasi
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {belumDibacaCount > 0 
                ? `Anda memiliki ${belumDibacaCount} notifikasi belum dibaca`
                : 'Semua notifikasi sudah dibaca'}
            </p>
          </div>
          {belumDibacaCount > 0 && (
            <button
              onClick={handleTandaiSemuaBaca}
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              Tandai Semua Dibaca
            </button>
          )}
        </div>

        {/* Filter */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setFilter('semua')}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === 'semua'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua ({notifikasi.length})
          </button>
          <button
            onClick={() => setFilter('belum-dibaca')}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === 'belum-dibaca'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Belum Dibaca ({belumDibacaCount})
          </button>
          <button
            onClick={() => setFilter('sudah-dibaca')}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === 'sudah-dibaca'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Sudah Dibaca ({notifikasi.length - belumDibacaCount})
          </button>
        </div>
      </div>

      {/* List Notifikasi */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-slate-200">
            <div className="text-slate-600">Memuat notifikasi...</div>
          </div>
        ) : notifikasiFiltered.length === 0 ? (
          <div className="rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-slate-200">
            <div className="text-slate-600">
              {filter === 'belum-dibaca' 
                ? 'Tidak ada notifikasi belum dibaca'
                : filter === 'sudah-dibaca'
                ? 'Tidak ada notifikasi sudah dibaca'
                : 'Belum ada notifikasi'}
            </div>
          </div>
        ) : (
          notifikasiFiltered.map((notif) => (
            <div
              key={notif.id}
              className={`rounded-3xl bg-white p-5 shadow-sm ring-1 transition hover:shadow-md ${
                notif.dibaca ? 'ring-slate-200' : 'ring-emerald-300 bg-emerald-50/30'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${getColor(notif.tipe)}`}>
                    {getIcon(notif.tipe)}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className={`text-sm font-bold ${notif.dibaca ? 'text-slate-700' : 'text-slate-900'}`}>
                        {notif.judul}
                      </h3>
                      <p className={`mt-1 text-sm ${notif.dibaca ? 'text-slate-600' : 'text-slate-700'}`}>
                        {notif.pesan}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-xs text-slate-500">{formatWaktu(notif.createdAt)}</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getColor(notif.tipe)}`}>
                          {notif.tipe.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!notif.dibaca && (
                        <button
                          onClick={() => handleTandaiBaca(notif.id)}
                          className="rounded-lg px-3 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-100"
                        >
                          ✓ Tandai Dibaca
                        </button>
                      )}
                      <button
                        onClick={() => handleHapus(notif.id)}
                        className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
