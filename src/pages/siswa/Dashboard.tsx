import { useMemo, useState, useEffect } from 'react'
import { getSession } from '../../lib/auth'
import { materiAPI, kuisAPI, nilaiAPI } from '../../lib/api'

type MateriStatus = 'Dipublikasikan' | 'Draft'
type MateriItem = { id: string; judul?: string; title?: string; kelas: string; status: MateriStatus }

type QuizStatus = 'Aktif' | 'Draft' | 'Selesai'
type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E'
type QuizQuestion = { id: string; text: string; options?: Record<ChoiceKey, string>; answer?: ChoiceKey }
type QuizItem = { id: string; judul?: string; title?: string; status: QuizStatus; peserta?: number; soal?: QuizQuestion[]; questions?: QuizQuestion[] }

type Attempt = {
  id: string
  kuis_id?: string
  quizId?: string
  judul_kuis?: string
  title?: string
  tanggal?: string
  date?: string
  nilai?: number
  score?: number
  benar?: number
  correct?: number
  total_soal?: number
  total?: number
  email?: string
}

function loadJsonArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function lastNDaysISO(n: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    out.push(`${yyyy}-${mm}-${dd}`)
  }
  return out
}

// Hook untuk load data dari API
function useApiData() {
  const [materiItems, setMateriItems] = useState<MateriItem[]>([])
  const [kuisItems, setKuisItems] = useState<QuizItem[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      // Load materi dari API
      try {
        const materiRes = await materiAPI.getAll({ status: 'Dipublikasikan' })
        if (materiRes.success && Array.isArray(materiRes.data)) {
          setMateriItems(materiRes.data)
        }
      } catch (err) {
        setMateriItems(loadJsonArray<MateriItem>('jk_teacher_materi'))
      }

      // Load kuis dari API
      try {
        const kuisRes = await kuisAPI.getAll({ status: 'Aktif' })
        if (kuisRes.success && Array.isArray(kuisRes.data)) {
          setKuisItems(kuisRes.data)
        }
      } catch (err) {
        setKuisItems(loadJsonArray<QuizItem>('jk_teacher_kuis'))
      }

      // Load nilai dari API
      try {
        const nilaiRes = await nilaiAPI.getNilai()
        if (nilaiRes.success && Array.isArray(nilaiRes.data)) {
          setAttempts(nilaiRes.data)
        }
      } catch (err) {
        setAttempts(loadJsonArray<Attempt>('jk_student_scores'))
      }

      setLoading(false)
    }
    loadData()
  }, [])

  return { materiItems, kuisItems, attempts, loading }
}

function LineChart({ values }: { values: number[] }) {
  const width = 360
  const height = 140
  const padding = 16

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)

  const xStep = (width - padding * 2) / Math.max(1, values.length - 1)

  const points = values
    .map((v, i) => {
      const x = padding + i * xStep
      const y = padding + (height - padding * 2) * (1 - (v - min) / range)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full">
      <defs>
        <linearGradient id="jkLine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(245 158 11)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(245 158 11)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgb(226 232 240)" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgb(226 232 240)" />

      <polyline points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`} fill="url(#jkLine)" stroke="none" />
      <polyline points={points} fill="none" stroke="rgb(245 158 11)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {values.map((v, i) => {
        const x = padding + i * xStep
        const y = padding + (height - padding * 2) * (1 - (v - min) / range)
        return <circle key={`${v}-${i}`} cx={x} cy={y} r={4} fill="rgb(245 158 11)" />
      })}
    </svg>
  )
}

function BarChart({ values }: { values: number[] }) {
  const width = 360
  const height = 140
  const padding = 16

  const max = Math.max(...values, 1)
  const barGap = 10
  const barCount = values.length
  const available = width - padding * 2 - barGap * (barCount - 1)
  const barWidth = available / barCount

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgb(226 232 240)" />
      {values.map((v, i) => {
        const h = (height - padding * 2) * (v / max)
        const x = padding + i * (barWidth + barGap)
        const y = height - padding - h
        return (
          <g key={`${v}-${i}`}>
            <rect x={x} y={y} width={barWidth} height={h} rx={10} fill="rgb(245 158 11)" opacity={0.85} />
            <text x={x + barWidth / 2} y={height - 4} textAnchor="middle" fontSize="10" fill="rgb(100 116 139)">
              K{i + 1}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function toDisplayName(email?: string): string | null {
  if (!email) return null
  const localPart = email.split('@')[0]?.trim()
  if (!localPart) return null

  const words = localPart
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (words.length === 0) return null
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function StudentDashboard() {
  const session = useMemo(() => getSession(), [])
  const name = useMemo(() => session?.nama || toDisplayName(session?.email), [session])
  
  // Load data dari API dengan fallback
  const { materiItems, kuisItems, attempts, loading } = useApiData()

  const materiCount = useMemo(() => {
    return materiItems.filter((m) => m.status === 'Dipublikasikan').length
  }, [materiItems])

  const kuisAktifCount = useMemo(() => {
    return kuisItems.filter((k) => k.status === 'Aktif').length
  }, [kuisItems])

  const avgScore = useMemo(() => {
    if (attempts.length === 0) return null
    const sum = attempts.reduce((acc, a) => {
      const score = a.nilai || a.score || 0
      return acc + (Number.isFinite(score) ? score : 0)
    }, 0)
    return round1(sum / attempts.length)
  }, [attempts])

  const weeklyScores = useMemo(() => {
    const days = lastNDaysISO(7)
    const byDay = new Map<string, number[]>()
    for (const d of days) byDay.set(d, [])

    for (const a of attempts) {
      const dateStr = a?.tanggal || a?.date
      if (!dateStr) continue
      const date = dateStr.split('T')[0] // Get YYYY-MM-DD part
      if (!byDay.has(date)) continue
      const score = a.nilai || a.score || 0
      if (!Number.isFinite(score)) continue
      byDay.get(date)!.push(score)
    }

    return days.map((d) => {
      const scores = byDay.get(d) ?? []
      if (scores.length === 0) return 0
      const sum = scores.reduce((acc, s) => acc + s, 0)
      return Math.round(sum / scores.length)
    })
  }, [attempts])

  const weeklyBadge = useMemo(() => {
    const recentNonZero = [...weeklyScores].reverse().find((v) => v > 0)
    return recentNonZero ?? null
  }, [weeklyScores])

  const lastScores = useMemo(() => {
    const vals = attempts
      .filter((a) => {
        const score = a.nilai || a.score || 0
        return Number.isFinite(score)
      })
      .slice(0, 4)
      .map((a) => a.nilai || a.score || 0)
    while (vals.length < 4) vals.push(0)
    return vals
  }, [attempts])

  const maxLast = useMemo(() => Math.max(...lastScores, 0), [lastScores])

  const quickStats = useMemo(
    () => [
      { label: 'Materi tersedia', value: String(materiCount) },
      { label: 'Kuis aktif', value: String(kuisAktifCount) },
      { label: 'Rata-rata nilai', value: avgScore === null ? '—' : String(avgScore) },
    ],
    [materiCount, kuisAktifCount, avgScore]
  )

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <p className="text-center text-slate-500">Memuat dashboard...</p>
        </div>
      ) : (
        <>
          <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
            <div className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
              Dashboard Siswa
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
              Selamat datang{name ? `, ${name}` : ''}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {session?.kelas && session?.jurusan 
                ? `Kelas ${session.kelas} - ${session.jurusan}`
                : 'Ini tampilan awal siswa. Data materi dan kuis dari backend Laravel.'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {quickStats.map((s) => (
              <div key={s.label} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="text-xs font-semibold text-slate-500">{s.label}</div>
                <div className="mt-2 text-3xl font-extrabold text-slate-800">{s.value}</div>
              </div>
            ))}
          </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold text-slate-800">Progres Mingguan</div>
              <div className="mt-1 text-xs text-slate-500">Rata-rata nilai kuis per hari (7 hari terakhir)</div>
            </div>
            <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              {weeklyBadge === null ? '—' : `${weeklyBadge}%`}
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <LineChart values={weeklyScores} />
          </div>
        </div>

        <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold text-slate-800">Nilai Kuis Terakhir</div>
              <div className="mt-1 text-xs text-slate-500">Skor 4 percobaan kuis terakhir</div>
            </div>
            <div className="text-xs font-semibold text-slate-600">Max: {maxLast}</div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <BarChart values={lastScores} />
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-lg font-extrabold text-slate-800">Aksi cepat</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <a
            href="/siswa/materi"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Buka Materi
          </a>
          <a
            href="/siswa/kuis"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Kerjakan Kuis
          </a>
          <a
            href="/siswa/nilai"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Lihat Nilai
          </a>
        </div>
      </div>
        </>
      )}
    </div>
  )
}
