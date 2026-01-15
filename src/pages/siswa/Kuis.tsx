import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { kuisAPI } from '../../lib/api'

type TeacherQuizStatus = 'Aktif' | 'Draft' | 'Selesai'

type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E'

type TeacherQuizQuestion = {
  id: string
  text: string
  options?: Record<ChoiceKey, string>
  answer?: ChoiceKey
}

type TeacherQuizItem = {
  id: string
  judul: string
  status: TeacherQuizStatus
  peserta?: number
  soal?: TeacherQuizQuestion[]
}

function loadFromLocalStorage(): TeacherQuizItem[] {
  try {
    const raw = localStorage.getItem('jk_teacher_kuis')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function Kuis() {
  const navigate = useNavigate()
  const [items, setItems] = useState<TeacherQuizItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadKuis()
  }, [])

  async function loadKuis() {
    try {
      setError(null)
      const response = await kuisAPI.getAll({ status: 'Aktif' })
      if (response.success && Array.isArray(response.data)) {
        setItems(response.data)
      } else {
        setItems(loadFromLocalStorage())
      }
    } catch (error: any) {
      setItems(loadFromLocalStorage())
      if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        setError('Tidak memiliki akses. Hubungi administrator.')
      }
    } finally {
      setLoading(false)
    }
  }

  const active = useMemo(() => items.filter((k) => k.status === 'Aktif'), [items])

  const canStart = (quiz: TeacherQuizItem): boolean => {
    const qs = quiz.soal ?? []
    if (qs.length === 0) return false
    return qs.every((q) => !!q.options && !!q.answer)
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat kuis...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-2xl font-extrabold tracking-tight text-slate-800">Kuis</div>
        <div className="mt-2 text-sm text-slate-600">Kuis aktif yang dibuat oleh guru.</div>
        {error && (
          <div className="mt-2 text-xs text-amber-600">{error}</div>
        )}
      </div>

      <div className="grid gap-4">
        {active.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            Belum ada kuis aktif dari guru.
          </div>
        ) : (
          active.map((q) => (
            <div key={q.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Kuis</div>
                  <div className="mt-1 text-lg font-extrabold text-slate-800">{q.judul}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Status: Aktif{q.soal ? ` • ${q.soal.length} pertanyaan` : ''}
                  </div>
                </div>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Aktif</span>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  disabled={!canStart(q)}
                  onClick={() => navigate(`/siswa/kuis/${q.id}`)}
                  className={
                    'rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ' +
                    (canStart(q)
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'cursor-not-allowed bg-slate-200 text-slate-500')
                  }
                >
                  Mulai
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
