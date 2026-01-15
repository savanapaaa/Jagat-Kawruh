import { useEffect, useMemo, useState } from 'react'
import { getSession } from '../../lib/auth'
import { materiAPI } from '../../lib/api'

type TeacherMateriStatus = 'Dipublikasikan' | 'Draft'

type TeacherMateriItem = {
  id: string
  judul: string
  kelas: string
  status: TeacherMateriStatus
  file_path?: string
  file_name?: string
  file_size?: number
}

export default function Materi() {
  const session = getSession()
  const [items, setItems] = useState<TeacherMateriItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMateri()
  }, [])

  async function loadMateri() {
    try {
      setError(null)
      const response = await materiAPI.getAll({ status: 'Dipublikasikan' })
      if (response.success && Array.isArray(response.data)) {
        setItems(response.data)
      } else {
        setError('Gagal memuat materi')
      }
    } catch (error: any) {
      if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        setItems([])
        setError('Tidak memiliki akses untuk melihat materi. Hubungi administrator.')
      } else {
        setError('Terjadi kesalahan saat memuat materi')
      }
    } finally {
      setLoading(false)
    }
  }

  const published = useMemo(() => items.filter((m) => m.status === 'Dipublikasikan'), [items])

  async function handleDownload(id: string) {
    try {
      await materiAPI.download(id)
    } catch (error) {
      console.error('Error downloading materi:', error)
      alert('Gagal mengunduh file')
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat materi...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-2xl font-extrabold tracking-tight text-slate-800">Materi</div>
        <div className="mt-2 text-sm text-slate-600">Daftar materi dari guru (PDF).</div>
        {session?.kelas && (
          <div className="mt-1 text-xs text-slate-500">Kelas: {session.kelas}</div>
        )}
      </div>

      {error && (
        <div className="rounded-3xl bg-rose-50 p-6 shadow-sm ring-1 ring-rose-200">
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      <div className="grid gap-4">
        {published.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            {error ? 'Tidak ada materi yang dapat ditampilkan' : 'Belum ada materi yang dipublikasikan oleh guru.'}
          </div>
        ) : (
          published.map((m) => (
            <div key={m.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Kelas {m.kelas}</div>
                  <div className="mt-1 text-lg font-extrabold text-slate-800">{m.judul}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    {m.file_name ? (
                      <span>
                        {m.file_name}
                        {m.file_size ? <span className="text-slate-400"> • {Math.ceil(m.file_size / 1024)} KB</span> : null}
                      </span>
                    ) : (
                      <span className="text-slate-400">PDF belum tersedia</span>
                    )}
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                  Dipublikasikan
                </span>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  disabled={!m.file_path}
                  className={
                    'rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ' +
                    (m.file_path
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'cursor-not-allowed bg-slate-200 text-slate-500')
                  }
                  onClick={() => handleDownload(m.id)}
                >
                  Download PDF
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
