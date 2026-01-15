import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSession } from '../../lib/auth'

type TeacherQuizStatus = 'Aktif' | 'Draft' | 'Selesai'
type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E'
type ChoiceOptions = Record<ChoiceKey, string>

type TeacherQuizQuestion = {
  id: string
  text: string
  image?: string
  options?: ChoiceOptions
  answer?: ChoiceKey
}

type TeacherQuizItem = {
  id: string
  title: string
  status: TeacherQuizStatus
  peserta: number
  questions?: TeacherQuizQuestion[]
}

type Attempt = {
  id: string
  quizId: string
  title: string
  date: string
  score: number
  correct: number
  total: number
  email?: string
}

const TEACHER_STORAGE_KEY = 'jk_teacher_kuis'
const SCORES_STORAGE_KEY = 'jk_student_scores'

function isChoiceKey(v: unknown): v is ChoiceKey {
  return v === 'A' || v === 'B' || v === 'C' || v === 'D' || v === 'E'
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function loadTeacherKuis(): TeacherQuizItem[] {
  try {
    const raw = localStorage.getItem(TEACHER_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed as TeacherQuizItem[]
  } catch {
    return []
  }
}

function loadAttempts(): Attempt[] {
  try {
    const raw = localStorage.getItem(SCORES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed as Attempt[]
  } catch {
    return []
  }
}

function saveAttempts(attempts: Attempt[]): void {
  localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(attempts))
}

function toDateString(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function hasValidOptions(q: TeacherQuizQuestion): q is TeacherQuizQuestion & { options: ChoiceOptions; answer: ChoiceKey } {
  if (!q.options || !isRecord(q.options)) return false
  if (!isChoiceKey(q.answer)) return false
  const opt = q.options as Record<string, unknown>
  return (
    typeof opt.A === 'string' &&
    typeof opt.B === 'string' &&
    typeof opt.C === 'string' &&
    typeof opt.D === 'string' &&
    typeof opt.E === 'string'
  )
}

export default function KuisMulai() {
  const navigate = useNavigate()
  const { quizId } = useParams()

  const quiz = useMemo(() => {
    if (!quizId) return null
    const all = loadTeacherKuis()
    return all.find((q) => q.id === quizId) ?? null
  }, [quizId])

  const questions = useMemo(() => quiz?.questions ?? [], [quiz])
  const supported = useMemo(() => questions.every((q) => hasValidOptions(q)), [questions])
  const total = questions.length

  const [answers, setAnswers] = useState<Record<string, ChoiceKey>>({})
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Attempt | null>(null)

  if (!quizId) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-lg font-extrabold text-slate-800">Kuis</div>
        <div className="mt-2 text-sm text-slate-600">ID kuis tidak ditemukan.</div>
        <button
          type="button"
          className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          onClick={() => navigate('/siswa/kuis')}
        >
          Kembali
        </button>
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-lg font-extrabold text-slate-800">Kuis tidak ditemukan</div>
        <div className="mt-2 text-sm text-slate-600">Kuis ini mungkin belum dibuat, atau sudah dihapus.</div>
        <button
          type="button"
          className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          onClick={() => navigate('/siswa/kuis')}
        >
          Kembali ke daftar kuis
        </button>
      </div>
    )
  }

  if (quiz.status !== 'Aktif') {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-lg font-extrabold text-slate-800">{quiz.title}</div>
        <div className="mt-2 text-sm text-slate-600">Kuis ini belum aktif.</div>
        <button
          type="button"
          className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          onClick={() => navigate('/siswa/kuis')}
        >
          Kembali
        </button>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-lg font-extrabold text-slate-800">{quiz.title}</div>
        <div className="mt-2 text-sm text-slate-600">Kuis ini belum memiliki pertanyaan.</div>
        <button
          type="button"
          className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          onClick={() => navigate('/siswa/kuis')}
        >
          Kembali
        </button>
      </div>
    )
  }

  if (!supported) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-lg font-extrabold text-slate-800">{quiz.title}</div>
        <div className="mt-2 text-sm text-slate-600">
          Format kuis ini belum lengkap (harus ada pilihan A–E dan kunci jawaban). Minta guru untuk memperbarui kuis.
        </div>
        <button
          type="button"
          className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          onClick={() => navigate('/siswa/kuis')}
        >
          Kembali
        </button>
      </div>
    )
  }

  if (result) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <div className="text-xs font-semibold text-slate-500">HASIL KUIS</div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-800">{result.title}</div>
          <div className="mt-2 text-sm text-slate-600">
            Benar {result.correct} dari {result.total} • Nilai{' '}
            <span className="font-semibold text-slate-800">{result.score}</span>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
              onClick={() => navigate('/siswa/nilai')}
            >
              Lihat Nilai
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => navigate('/siswa/kuis')}
            >
              Kembali ke daftar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-xs font-semibold text-slate-500">KERJAKAN KUIS</div>
        <div className="mt-2 text-2xl font-extrabold tracking-tight text-slate-800">{quiz.title}</div>
        <div className="mt-2 text-sm text-slate-600">Pilih jawaban A–E untuk setiap pertanyaan, lalu submit.</div>
      </div>

      <div className="space-y-4">
        {(questions as Array<TeacherQuizQuestion & { options: ChoiceOptions; answer: ChoiceKey }>).map((q, idx) => (
          <div key={q.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-500">Pertanyaan {idx + 1}</div>
            <div className="mt-2 text-base font-extrabold text-slate-800">{q.text}</div>

            {/* Tampilkan gambar soal jika ada */}
            {q.image && (
              <div className="mt-3">
                <img src={q.image} alt={`Soal ${idx + 1}`} className="max-h-64 rounded-xl border border-slate-200" />
              </div>
            )}

            <div className="mt-4 grid gap-2">
              {(['A', 'B', 'C', 'D', 'E'] as const).map((key) => (
                <label
                  key={key}
                  className={
                    'flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ' +
                    (answers[q.id] === key
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50')
                  }
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={key}
                    checked={answers[q.id] === key}
                    onChange={() => {
                      setAnswers((prev) => ({ ...prev, [q.id]: key }))
                      setError(null)
                    }}
                    className="mt-1"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-500">{key}</div>
                    <div className="text-slate-700">{q.options[key]}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {error ? <div className="text-sm font-semibold text-rose-600">{error}</div> : null}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
            onClick={() => {
              const unanswered = questions.find((q) => !(q.id in answers))
              if (unanswered) {
                setError('Masih ada pertanyaan yang belum dijawab.')
                return
              }

              const supportedQuestions = questions.filter((q) => hasValidOptions(q))
              const correct = supportedQuestions.reduce((acc, q) => acc + (answers[q.id] === q.answer ? 1 : 0), 0)
              const score = Math.round((correct / supportedQuestions.length) * 100)

              const session = getSession()
              const email = session?.email

              const attempt: Attempt = {
                id: `N-${Date.now()}`,
                quizId: quiz.id,
                title: quiz.title,
                date: toDateString(new Date()),
                score,
                correct,
                total: supportedQuestions.length,
                email,
              }

              const attempts = loadAttempts()
              saveAttempts([attempt, ...attempts])

              // Update peserta count (best-effort)
              try {
                const all = loadTeacherKuis()
                const next = all.map((it) => (it.id === quiz.id ? { ...it, peserta: (it.peserta ?? 0) + 1 } : it))
                localStorage.setItem(TEACHER_STORAGE_KEY, JSON.stringify(next))
              } catch {
                // ignore
              }

              setResult(attempt)
            }}
          >
            Submit
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => navigate('/siswa/kuis')}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  )
}
