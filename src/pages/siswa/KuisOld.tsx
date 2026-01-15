import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
  title: string
  status: TeacherQuizStatus
  peserta: number
  questions?: TeacherQuizQuestion[]
}

const STORAGE_KEY = 'jk_teacher_kuis'

function loadTeacherKuis(): TeacherQuizItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as TeacherQuizItem[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export default function Kuis() {
  const navigate = useNavigate()
  const [items, setItems] = useState<TeacherQuizItem[]>(() => loadTeacherKuis())

  useEffect(() => {
    const refresh = () => setItems(loadTeacherKuis())
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  const active = useMemo(() => items.filter((k) => k.status === 'Aktif'), [items])

  const canStart = (quiz: TeacherQuizItem): boolean => {
    const qs = quiz.questions ?? []
    if (qs.length === 0) return false
    return qs.every((q) => !!q.options && !!q.answer)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-2xl font-extrabold tracking-tight text-slate-800">Kuis</div>
        <div className="mt-2 text-sm text-slate-600">Kuis aktif yang dibuat oleh guru.</div>
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
                  <div className="mt-1 text-lg font-extrabold text-slate-800">{q.title}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Status: Aktif{q.questions ? ` • ${q.questions.length} pertanyaan` : ''}
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
