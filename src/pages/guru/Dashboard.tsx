import { useEffect, useMemo, useState } from 'react'
import { materiAPI, kuisAPI, pblAPI } from '../../lib/api'

export default function TeacherDashboard() {
  const [totalMateri, setTotalMateri] = useState(0)
  const [totalKuis, setTotalKuis] = useState(0)
  const [totalPBL, setTotalPBL] = useState(0)
  const [loading, setLoading] = useState(true)
  const [kuisStatusCounts, setKuisStatusCounts] = useState<{ aktif: number; draft: number; selesai: number }>({
    aktif: 0,
    draft: 0,
    selesai: 0,
  })
  const [pendingGrade, setPendingGrade] = useState<{ materi: number; pbl: number }>({ materi: 0, pbl: 0 })

  useEffect(() => {
    loadStats()
  }, [])

  const totalKuisByStatus = useMemo(
    () => kuisStatusCounts.aktif + kuisStatusCounts.draft + kuisStatusCounts.selesai,
    [kuisStatusCounts]
  )

  const totalPendingGrade = useMemo(() => pendingGrade.materi + pendingGrade.pbl, [pendingGrade])

  function isTruthyFlag(value: any, defaultWhenMissing = true): boolean {
    if (value == null) return defaultWhenMissing
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase()
      if (v === '0' || v === 'false' || v === 'no' || v === 'nonaktif' || v === 'inactive' || v === 'off') return false
      if (v === '1' || v === 'true' || v === 'yes' || v === 'aktif' || v === 'active' || v === 'on') return true
    }
    return defaultWhenMissing
  }

  function extractArrayFromPayload(payload: any): any[] {
    if (Array.isArray(payload)) return payload
    const directKeys = ['data', 'items', 'results', 'submissions', 'nilai', 'kuis']
    for (const key of directKeys) {
      const candidate = payload?.[key]
      if (Array.isArray(candidate)) return candidate
    }
    const nested = payload?.data
    if (nested && typeof nested === 'object') {
      for (const key of directKeys) {
        const candidate = nested?.[key]
        if (Array.isArray(candidate)) return candidate
      }
    }
    const doublyNested = payload?.data?.data
    if (Array.isArray(doublyNested)) return doublyNested
    return []
  }

  function isNilaiMissing(value: any): boolean {
    if (value == null) return true
    if (typeof value === 'number') return !Number.isFinite(value)
    if (typeof value === 'string') return value.trim().length === 0
    return false
  }

  async function loadStats() {
    try {
      const [materiRes, kuisRes, pblRes] = await Promise.all([
        materiAPI.getAll(),
        kuisAPI.getAll(),
        pblAPI.getAll(),
      ])
      
      // Backend sudah auto-filter by created_by untuk guru
      const materiList = Array.isArray(materiRes.data) ? materiRes.data : []
      const kuisList = Array.isArray(kuisRes.data) ? kuisRes.data : []

      setTotalMateri(materiList.length)
      setTotalKuis(kuisList.length)
      const pblList: any = (pblRes as any).data?.data ?? (pblRes as any).data
      setTotalPBL(Array.isArray(pblList) ? pblList.length : 0)

      // ===== Kuis status breakdown =====
      const counts = { aktif: 0, draft: 0, selesai: 0 }
      for (const k of kuisList) {
        const raw = k?.status
        const s = raw != null ? String(raw).trim().toLowerCase() : ''
        if (s === 'aktif' || s === 'active' || s === 'published') counts.aktif += 1
        else if (s === 'draft') counts.draft += 1
        else if (s === 'selesai' || s === 'done' || s === 'finished') counts.selesai += 1
        else counts.draft += 1
      }
      setKuisStatusCounts(counts)

      // ===== Pending grades (Materi + PBL) =====
      const concurrency = 5
      const materiCandidates = materiList.filter((m: any) => isTruthyFlag(m?.tugas_enabled, true))

      let pendingMateri = 0
      for (let i = 0; i < materiCandidates.length; i += concurrency) {
        const chunk = materiCandidates.slice(i, i + concurrency)
        const results = await Promise.allSettled(chunk.map((m: any) => materiAPI.getSubmissions(String(m?.id))))
        for (const r of results) {
          if (r.status !== 'fulfilled') continue
          const subs = extractArrayFromPayload(r.value?.data)
          for (const raw of subs) {
            if (isNilaiMissing((raw as any)?.nilai)) pendingMateri += 1
          }
        }
      }

      let pendingPbl = 0
      const pblArray: any[] = Array.isArray(pblList) ? pblList : []
      for (let i = 0; i < pblArray.length; i += concurrency) {
        const chunk = pblArray.slice(i, i + concurrency)
        const results = await Promise.allSettled(chunk.map((p: any) => pblAPI.getSubmissions(String(p?.id))))
        for (const r of results) {
          if (r.status !== 'fulfilled') continue
          const subs = extractArrayFromPayload(r.value?.data)
          for (const raw of subs) {
            if (isNilaiMissing((raw as any)?.nilai)) pendingPbl += 1
          }
        }
      }

      setPendingGrade({ materi: pendingMateri, pbl: pendingPbl })
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
          Dasbor Guru
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
              <div className="text-sm font-extrabold text-slate-800">Status Kuis</div>
              <div className="mt-1 text-xs text-slate-500">Ringkasan kuis yang Anda buat</div>
            </div>
            <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Total: {loading ? '...' : totalKuisByStatus}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold text-slate-500">Aktif</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-800">{loading ? '...' : kuisStatusCounts.aktif}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold text-slate-500">Draf</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-800">{loading ? '...' : kuisStatusCounts.draft}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold text-slate-500">Selesai</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-800">{loading ? '...' : kuisStatusCounts.selesai}</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold text-slate-800">Perlu Dinilai</div>
              <div className="mt-1 text-xs text-slate-500">Submission yang belum diberi nilai</div>
            </div>
            <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Total: {loading ? '...' : totalPendingGrade}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold text-slate-500">Tugas Materi</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-800">{loading ? '...' : pendingGrade.materi}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold text-slate-500">Submission PBL</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-800">{loading ? '...' : pendingGrade.pbl}</div>
            </div>
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
