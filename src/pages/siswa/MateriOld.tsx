import { useMemo, useState } from 'react'
import { getFile } from '../../lib/idbFiles'

type TeacherMateriStatus = 'Dipublikasikan' | 'Draft'

type TeacherMateriItem = {
  id: string
  title: string
  kelas: string
  status: TeacherMateriStatus
  fileId?: string
  fileName?: string
  fileSize?: number
}

const STORAGE_KEY = 'jk_teacher_materi'

function loadTeacherMateri(): TeacherMateriItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as TeacherMateriItem[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export default function Materi() {
  const [items] = useState<TeacherMateriItem[]>(() => loadTeacherMateri())

  const published = useMemo(() => items.filter((m) => m.status === 'Dipublikasikan'), [items])

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-2xl font-extrabold tracking-tight text-slate-800">Materi</div>
        <div className="mt-2 text-sm text-slate-600">Daftar materi dari guru (PDF).</div>
      </div>

      <div className="grid gap-4">
        {published.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            Belum ada materi yang dipublikasikan oleh guru.
          </div>
        ) : (
          published.map((m) => (
            <div key={m.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Kelas {m.kelas}</div>
                  <div className="mt-1 text-lg font-extrabold text-slate-800">{m.title}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    {m.fileName ? (
                      <span>
                        {m.fileName}
                        {m.fileSize ? <span className="text-slate-400"> • {Math.ceil(m.fileSize / 1024)} KB</span> : null}
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
                  disabled={!m.fileId}
                  className={
                    'rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ' +
                    (m.fileId
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'cursor-not-allowed bg-slate-200 text-slate-500')
                  }
                  onClick={async () => {
                    if (!m.fileId) return
                    const record = await getFile(m.fileId)
                    if (!record) return
                    const url = URL.createObjectURL(record.blob)
                    window.open(url, '_blank', 'noopener,noreferrer')
                    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
                  }}
                >
                  Buka PDF
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
