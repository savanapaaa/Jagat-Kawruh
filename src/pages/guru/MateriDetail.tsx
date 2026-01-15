import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getFile } from '../../lib/idbFiles'

type MateriStatus = 'Dipublikasikan' | 'Draft'

type MateriItem = {
  id: string
  title: string
  kelas: string
  status: MateriStatus
  fileId?: string
  fileName?: string
  fileSize?: number
}

const STORAGE_KEY = 'jk_teacher_materi'

function loadMateri(): MateriItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as MateriItem[]
  } catch {
    return []
  }
}

function saveMateri(items: MateriItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export default function MateriDetail() {
  const navigate = useNavigate()
  const { materiId } = useParams()
  const [materi, setMateri] = useState<MateriItem | null>(null)

  useEffect(() => {
    const all = loadMateri()
    const found = all.find((m) => m.id === materiId)
    if (found) {
      setMateri(found)
    } else {
      navigate('/guru/materi')
    }
  }, [materiId, navigate])

  function handleStatusChange(newStatus: MateriStatus) {
    if (!materi) return
    const all = loadMateri()
    const updated = all.map((m) => (m.id === materi.id ? { ...m, status: newStatus } : m))
    saveMateri(updated)
    setMateri({ ...materi, status: newStatus })
  }

  if (!materi) return null

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
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-800">{materi.title}</h1>
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
          <div className="mt-1 text-2xl font-extrabold text-slate-800">{materi.kelas}</div>
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
            {materi.fileName ? (
              <span className="text-emerald-600">✓ {materi.fileName}</span>
            ) : (
              <span className="text-slate-400">Tidak ada file</span>
            )}
          </div>
        </div>
      </div>

      {/* File Download/View */}
      {materi.fileId && materi.fileName && (
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
                <div className="text-sm font-semibold text-slate-800">{materi.fileName}</div>
                <div className="text-xs text-slate-500">
                  {materi.fileSize ? `${Math.ceil(materi.fileSize / 1024)} KB` : 'File tersimpan'}
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!materi.fileId) return
                  const record = await getFile(materi.fileId)
                  if (!record) {
                    alert('File tidak ditemukan')
                    return
                  }
                  const url = URL.createObjectURL(record.blob)
                  window.open(url, '_blank', 'noopener,noreferrer')
                  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
                }}
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
