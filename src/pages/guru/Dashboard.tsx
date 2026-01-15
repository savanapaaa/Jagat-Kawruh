import { useEffect, useState } from 'react'
import { materiAPI, kuisAPI, pblAPI } from '../../lib/api'

const submissionsWeekly = [4, 6, 5, 8, 7, 9, 14]
const avgQuizScores = [78, 84, 81, 88]

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
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        className="stroke-slate-200"
      />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="stroke-slate-200" />

      <polyline
        points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
        className="fill-amber-500"
        opacity={0.12}
        stroke="none"
      />
      <polyline
        points={points}
        className="stroke-amber-500"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {values.map((v, i) => {
        const x = padding + i * xStep
        const y = padding + (height - padding * 2) * (1 - (v - min) / range)
        return <circle key={`${v}-${i}`} cx={x} cy={y} r={4} className="fill-amber-500" />
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
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        className="stroke-slate-200"
      />
      {values.map((v, i) => {
        const h = (height - padding * 2) * (v / max)
        const x = padding + i * (barWidth + barGap)
        const y = height - padding - h
        return (
          <g key={`${v}-${i}`}>
            <rect x={x} y={y} width={barWidth} height={h} rx={10} className="fill-amber-500" opacity={0.85} />
            <text
              x={x + barWidth / 2}
              y={height - 4}
              textAnchor="middle"
              fontSize="10"
              className="fill-slate-500"
            >
              K{i + 1}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function TeacherDashboard() {
  const [totalMateri, setTotalMateri] = useState(0)
  const [totalKuis, setTotalKuis] = useState(0)
  const [totalPBL, setTotalPBL] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const [materiRes, kuisRes, pblRes] = await Promise.all([
        materiAPI.getAll(),
        kuisAPI.getAll(),
        pblAPI.getAll()
      ])
      
      // Backend sudah auto-filter by created_by untuk guru
      setTotalMateri(materiRes.data?.length || 0)
      setTotalKuis(kuisRes.data?.length || 0)
      setTotalPBL(pblRes.data?.length || 0)
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const quickStats = [
    { label: 'Materi dibuat', value: loading ? '...' : String(totalMateri) },
    { label: 'Kuis dibuat', value: loading ? '...' : String(totalKuis) },
    { label: 'Project PBL', value: loading ? '...' : String(totalPBL) },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
          Dashboard Guru
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">Ringkasan kelas</h1>
        <p className="mt-2 text-sm text-slate-600">
          Statistik materi, kuis, dan project yang Anda buat.
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
              <div className="text-sm font-extrabold text-slate-800">Pengumpulan Tugas Mingguan</div>
              <div className="mt-1 text-xs text-slate-500">Jumlah pengumpulan per hari (dummy)</div>
            </div>
            <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Total: {submissionsWeekly.reduce((a, b) => a + b, 0)}
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <LineChart values={submissionsWeekly} />
          </div>
        </div>

        <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold text-slate-800">Rata-rata Nilai Kuis</div>
              <div className="mt-1 text-xs text-slate-500">Rata-rata 4 kuis terakhir (dummy)</div>
            </div>
            <div className="text-xs font-semibold text-slate-600">Max: {Math.max(...avgQuizScores)}</div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <BarChart values={avgQuizScores} />
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-lg font-extrabold text-slate-800">Aksi cepat</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <a
            href="/guru/materi"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Tambah Materi
          </a>
          <a
            href="/guru/kuis"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Buat Kuis
          </a>
          <a
            href="/guru/nilai"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Rekap Nilai
          </a>
        </div>
      </div>
    </div>
  )
}
