import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { materiAPI } from '../../lib/api'

type MateriStatus = 'Dipublikasikan' | 'Draft'

type MateriItem = {
  id: string
  judul: string
  kelas: string | string[]
  status: MateriStatus
  file_path?: string
  file_name?: string
  file_size?: number
}

export default function MateriDetail() {
  const navigate = useNavigate()
  const { materiId } = useParams()
  const [materi, setMateri] = useState<MateriItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMateri()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materiId])

  async function loadMateri() {
    if (!materiId) {
      navigate('/guru/materi')
      return
    }

    try {
      const response = await materiAPI.getById(materiId)
      if (response.success && response.data) {
        setMateri(response.data)
      } else {
        alert('Materi tidak ditemukan')
        navigate('/guru/materi')
      }
    } catch (error) {
      console.error('Error loading materi:', error)
      alert('Gagal memuat detail materi')
      navigate('/guru/materi')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(newStatus: MateriStatus) {
    if (!materi) return
    
    try {
      const response = await materiAPI.update(materi.id, { status: newStatus })
      if (response.success) {
        setMateri({ ...materi, status: newStatus })
        alert('Status materi berhasil diubah!')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Gagal mengubah status materi')
    }
  }

  async function handleDownload() {
    if (!materi) return
    
    try {
      await materiAPI.download(materi.id)
    } catch (error) {
      console.error('Error downloading file:', error)
      alert('Gagal mengunduh file')
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat detail materi...</p>
      </div>
    )
  }

  if (!materi) return null

  // Handle kelas bisa array atau string
  const kelasDisplay = Array.isArray(materi.kelas) ? materi.kelas.join(', ') : materi.kelas

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
      {/* Header dengan tombol kembali */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/guru/materi')}
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="text-xs font-semibold tracking-wide text-slate-500">DETAIL MATERI</div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-800">{materi.judul}</h1>
        </div>
        <div
          className={
            'shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ' +
            (materi.status === 'Dipublikasikan'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-200 text-slate-700')
          }
        >
          {materi.status}
        </div>
      </div>

      {/* Info Materi */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">Kelas</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-800">{kelasDisplay}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">Status</div>
          <select
            value={materi.status}
            onChange={(e) => handleStatusChange(e.target.value as MateriStatus)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-400"
          >
            <option value="Draft">Draft</option>
            <option value="Dipublikasikan">Dipublikasikan</option>
          </select>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">File Materi</div>
          <div className="mt-2 text-sm font-semibold text-slate-800">
            {materi.file_name ? (
              <span className="text-emerald-600">✓ {materi.file_name}</span>
            ) : (
              <span className="text-slate-400">Tidak ada file</span>
            )}
          </div>
        </div>
      </div>

      {/* File Download/View */}
      {materi.file_name && (
        <div className="mt-6">
          <div className="mb-3 text-lg font-extrabold text-slate-800">File Materi</div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800">{materi.file_name}</div>
                <div className="text-xs text-slate-500">
                  {materi.file_size ? `${Math.ceil(materi.file_size / 1024)} KB` : 'File tersimpan'}
                </div>
              </div>
              <button
                onClick={handleDownload}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                Lihat PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
