import { useEffect, useMemo, useState } from 'react'
import { authAPI, nilaiAPI, pblAPI, kuisAPI, materiAPI } from '../../lib/api'
import { getSession } from '../../lib/auth'

type NilaiType = 'kuis' | 'pbl' | 'materi'

type Attempt = {
  id: string
  kuis_id?: string
  judul_kuis?: string
  kuis_judul?: string
  project_id?: string
  project_judul?: string
  kelompok_id?: string
  feedback?: string
  tanggal?: string
  created_at?: string
  nilai?: number
  score?: number
  benar?: number
  total_soal?: number
  total?: number
  email?: string
}

type NilaiRow = {
  id: string
  type: NilaiType
  title: string
  tanggal?: string
  nilai: number
  project_id?: string
  kelompok_id?: string
  materi_id?: string
  kuis_id?: string
  benar?: number
  total?: number
}

function normalizeSiswaIdKey(value: unknown): string {
  const s = String(value ?? '').trim()
  if (!s) return ''
  const match = s.match(/^siswa-(\d+)$/i)
  if (match?.[1]) return `siswa-${match[1]}`
  if (/^\d+$/.test(s)) return `siswa-${s}`
  return s
}

function getCurrentSiswaIdKey(): string {
  try {
    const session = getSession()
    const fromSession = session?.id
    const normalizedFromSession = normalizeSiswaIdKey(fromSession)
    if (normalizedFromSession) return normalizedFromSession

    const raw = localStorage.getItem('session')
    if (!raw) return ''
    const user = JSON.parse(raw)
    const id = user?.id ?? user?.user?.id ?? user?.siswa?.id ?? user?.profile?.id
    return normalizeSiswaIdKey(id)
  } catch {
    return ''
  }
}

async function getCurrentSiswaIdKeyBestEffort(): Promise<string> {
  const local = getCurrentSiswaIdKey()
  if (local) return local

  try {
    const me = await authAPI.me()
    if (!me?.success) return ''
    const user = (me.data?.user ?? me.data) as any
    return normalizeSiswaIdKey(user?.id)
  } catch {
    return ''
  }
}

function round0(n: number): number {
  return Math.round(n)
}

function QuizTrendChart({ points }: { points: Array<{ label: string; value: number }> }) {
  const width = 360
  const height = 160
  const paddingX = 16
  const paddingY = 18

  const values = points.map((p) => p.value)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 100)
  const range = Math.max(1, max - min)
  const xStep = (width - paddingX * 2) / Math.max(1, points.length - 1)

  const linePoints = points
    .map((p, i) => {
      const x = paddingX + i * xStep
      const y = paddingY + (height - paddingY * 2) * (1 - (p.value - min) / range)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
        {/* grid */}
        <line className="text-slate-200" x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="currentColor" />
        <line className="text-slate-200" x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} stroke="currentColor" />

        {/* line */}
        <polyline className="text-amber-500" points={linePoints} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

        {/* dots */}
        {points.map((p, i) => {
          const x = paddingX + i * xStep
          const y = paddingY + (height - paddingY * 2) * (1 - (p.value - min) / range)
          return <circle key={`${p.label}-${i}`} className="text-amber-500" cx={x} cy={y} r={4} fill="currentColor" />
        })}
      </svg>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <div>{points[0]?.label ?? ''}</div>
        <div>{points[points.length - 1]?.label ?? ''}</div>
      </div>
    </div>
  )
}

function normalizeNilaiAll(data: any): NilaiRow[] {
  const rows: NilaiRow[] = []

  const pushRow = (type: NilaiType, a: any) => {
    if (!a) return
    const id = String(a.id ?? '')
    if (!id) return

    const title =
      type === 'kuis'
        ? String(a.judul_kuis ?? a.kuis_judul ?? a.title ?? '-')
        : type === 'pbl'
        ? String(a.project_judul ?? a.judul_project ?? a.judul ?? a.title ?? '-')
        : String(a.materi_judul ?? a.materi ?? a.judul ?? a.title ?? '-')

    const nilaiValue = Number(a.nilai ?? a.score ?? 0)
    const benar = a.benar ?? a.correct
    const total = a.total_soal ?? a.total

    const project_id = a?.project_id != null ? String(a.project_id) : a?.pbl_id != null ? String(a.pbl_id) : undefined
    const kelompok_id = a?.kelompok_id != null ? String(a.kelompok_id) : undefined
    const materi_id = a?.materi_id != null ? String(a.materi_id) : undefined
    const kuis_id = a?.kuis_id != null ? String(a.kuis_id) : undefined

    rows.push({
      id,
      type,
      title,
      tanggal: a.tanggal ?? a.created_at ?? a.date,
      nilai: Number.isFinite(nilaiValue) ? nilaiValue : 0,
      ...(type === 'pbl' ? { project_id, kelompok_id } : {}),
      ...(type === 'materi' ? { materi_id } : {}),
      ...(type === 'kuis' ? { kuis_id } : {}),
      benar: benar != null ? Number(benar) : undefined,
      total: total != null ? Number(total) : undefined,
    })
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const kuisList = Array.isArray((data as any).kuis) ? (data as any).kuis : []
    const pblList = Array.isArray((data as any).pbl) ? (data as any).pbl : []
    const materiList = Array.isArray((data as any).materi) ? (data as any).materi : []
    kuisList.forEach((a: any) => pushRow('kuis', a))
    pblList.forEach((a: any) => pushRow('pbl', a))
    materiList.forEach((a: any) => pushRow('materi', a))

    const flat = Array.isArray((data as any).data) ? (data as any).data : null
    if (flat) {
      flat.forEach((a: any) => {
        const inferred: NilaiType = a?.project_id || a?.project_judul ? 'pbl' : a?.materi_id || a?.materi_judul ? 'materi' : 'kuis'
        pushRow(inferred, a)
      })
    }
  } else if (Array.isArray(data)) {
    data.forEach((a: any) => {
      const inferred: NilaiType = a?.project_id || a?.project_judul ? 'pbl' : a?.materi_id || a?.materi_judul ? 'materi' : 'kuis'
      pushRow(inferred, a)
    })
  }

  return rows.sort((a, b) => {
    const ad = a.tanggal ? Date.parse(a.tanggal) : 0
    const bd = b.tanggal ? Date.parse(b.tanggal) : 0
    return bd - ad
  })
}

async function applyPblIndividualOverrides(input: NilaiRow[]): Promise<NilaiRow[]> {
  const siswaKey = await getCurrentSiswaIdKeyBestEffort()
  if (!siswaKey) return input

  const targets = Array.from(
    new Set(
      input
        .filter((r) => r.type === 'pbl' && r.project_id && r.kelompok_id)
        .map((r) => `${r.project_id}::${r.kelompok_id}`)
    )
  )
  if (targets.length === 0) return input

  const results = await Promise.allSettled(
    targets.map(async (key) => {
      const [pblId, kelompokId] = key.split('::')
      const res = await pblAPI.getNilaiIndividuKelompok(String(pblId), String(kelompokId))
      return { key, res }
    })
  )

  const overrideByTargetKey: Record<string, number> = {}

  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    const { key, res } = r.value as any
    if (!res?.success) continue

    let arr: any[] = []
    if (Array.isArray(res?.data)) arr = res.data
    else if (Array.isArray(res?.data?.data)) arr = res?.data?.data
    else if (Array.isArray(res?.data?.nilai_individu)) arr = res?.data?.nilai_individu
    else if (Array.isArray(res?.data?.data?.nilai_individu)) arr = res?.data?.data?.nilai_individu
    else arr = []

    if (!Array.isArray(arr) || arr.length === 0) {
      console.debug('[Nilai] no nilai_individu array for', key, res)
      continue
    }

    const hit = arr.find((row: any) => normalizeSiswaIdKey(row?.siswa_id ?? row?.siswa ?? row?.id) === siswaKey)
    if (!hit) continue

    const nilai = Number(hit?.nilai)
    if (!Number.isFinite(nilai)) continue
    overrideByTargetKey[key] = nilai
  }

  if (Object.keys(overrideByTargetKey).length === 0) return input

  return input.map((row) => {
    if (row.type !== 'pbl' || !row.project_id || !row.kelompok_id) return row
    const key = `${row.project_id}::${row.kelompok_id}`
    const override = overrideByTargetKey[key]
    if (override == null) return row
    return { ...row, nilai: override }
  })
}

function loadFromLocalStorage(): Attempt[] {
  try {
    const raw = localStorage.getItem('jk_student_scores')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const list = Array.isArray(parsed) ? (parsed as Attempt[]) : []
    const session = getSession()
    const email = session?.email
    const filtered = email ? list.filter((x) => !x.email || x.email === email) : list
    return filtered.sort((a, b) => {
      const ad = a.tanggal ? Date.parse(a.tanggal) : 0
      const bd = b.tanggal ? Date.parse(b.tanggal) : 0
      return bd - ad
    })
  } catch {
    return []
  }
}

export default function Nilai() {
  const [items, setItems] = useState<NilaiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const kuisItems = useMemo(() => items.filter((x) => x.type === 'kuis'), [items])
  const pblItems = useMemo(() => items.filter((x) => x.type === 'pbl'), [items])
  const materiItems = useMemo(() => items.filter((x) => x.type === 'materi'), [items])

  const kuisChartPoints = useMemo(() => {
    const list = kuisItems
      .map((x) => {
        const iso = x.tanggal
        const ms = iso ? Date.parse(iso) : NaN
        return { ...x, ms }
      })
      .filter((x) => Number.isFinite(x.ms))
      .sort((a, b) => a.ms - b.ms)

    const last = list.slice(-10)
    return last.map((x) => {
      const d = new Date(x.ms)
      const label = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
      return { label, value: round0(Number(x.nilai ?? 0)) }
    })
  }, [kuisItems])

  useEffect(() => {
    loadNilai()
  }, [])

  async function loadNilai() {
    try {
      setError(null)
      const response = await nilaiAPI.getNilai({ type: 'all' })
      if (response.success) {
        const list = normalizeNilaiAll(response.data)
        if (list.length > 0) {
          try {
            const [kuisRes, pblRes, materiRes] = await Promise.all([
              kuisAPI.getAll(),
              pblAPI.getAll(),
              materiAPI.getAll()
            ])
            const activeKuisIds = new Set((Array.isArray((kuisRes as any).data?.data) ? (kuisRes as any).data.data : Array.isArray((kuisRes as any).data) ? (kuisRes as any).data : []).map((x: any) => String(x.id)))
            const activePblIds = new Set((Array.isArray((pblRes as any).data?.data) ? (pblRes as any).data.data : Array.isArray((pblRes as any).data) ? (pblRes as any).data : []).map((x: any) => String(x.id)))
            const activeMateriIds = new Set((Array.isArray((materiRes as any).data?.data) ? (materiRes as any).data.data : Array.isArray((materiRes as any).data) ? (materiRes as any).data : []).map((x: any) => String(x.id)))

            const filteredList = list.filter((r) => {
              if (r.type === 'kuis' && r.kuis_id) return activeKuisIds.has(r.kuis_id)
              if (r.type === 'pbl' && r.project_id) return activePblIds.has(r.project_id)
              if (r.type === 'materi' && r.materi_id) return activeMateriIds.has(r.materi_id)
              return true
            })

            const withOverrides = await applyPblIndividualOverrides(filteredList).catch(() => filteredList)
            setItems(withOverrides)
          } catch (e) {
            console.error('Error filtering active tasks', e)
            const withOverrides = await applyPblIndividualOverrides(list).catch(() => list)
            setItems(withOverrides)
          }
          return
        }
      }

      const localKuis = loadFromLocalStorage().map((a) => ({
        id: a.id,
        type: 'kuis' as const,
        title: String(a.judul_kuis ?? a.kuis_judul ?? '-'),
        tanggal: a.tanggal ?? (a as any).created_at,
        nilai: Number(a.nilai ?? a.score ?? 0),
        benar: a.benar != null ? Number(a.benar) : undefined,
        total: a.total_soal != null ? Number(a.total_soal) : undefined,
      }))
      setItems(localKuis)
    } catch (error: any) {
      // Fallback tanpa log untuk console yang bersih
      const localKuis = loadFromLocalStorage().map((a) => ({
        id: a.id,
        type: 'kuis' as const,
        title: String(a.judul_kuis ?? a.kuis_judul ?? '-'),
        tanggal: a.tanggal ?? (a as any).created_at,
        nilai: Number(a.nilai ?? a.score ?? 0),
        benar: a.benar != null ? Number(a.benar) : undefined,
        total: a.total_soal != null ? Number(a.total_soal) : undefined,
      }))
      setItems(localKuis)
      if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        setError('Menggunakan data lokal (backend belum siap)')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat nilai...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
          Nilai Siswa
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">Nilai</h1>
        <p className="mt-2 text-sm text-slate-600">Rekap nilai dari kuis dan PBL yang sudah kamu kerjakan.</p>
        {error && (
          <div className="mt-2 text-xs text-amber-600">{error}</div>
        )}
      </div>

      {kuisItems.length === 0 && pblItems.length === 0 && materiItems.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          Belum ada nilai. Kerjakan kuis, materi, atau PBL terlebih dahulu.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="text-lg font-extrabold tracking-tight text-slate-800">Nilai Kuis</div>
            <div className="mt-1 text-sm text-slate-600">Rekap hasil kuis yang sudah kamu kerjakan.</div>

            {kuisItems.length === 0 ? (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                Belum ada nilai kuis.
              </div>
            ) : (
              <div className="mt-4">
                {kuisChartPoints.length >= 2 ? (
                  <QuizTrendChart points={kuisChartPoints} />
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                    Grafik butuh minimal 2 data nilai dengan tanggal.
                  </div>
                )}

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Kuis</th>
                        <th className="px-4 py-3">Tanggal</th>
                        <th className="px-4 py-3">Nilai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kuisItems.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-800">{s.title || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {(() => {
                              const iso = s.tanggal
                              return iso ? new Date(iso).toLocaleDateString('id-ID') : '-'
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                              {Number.isFinite(s.nilai) ? s.nilai.toFixed(2) : '0.00'}
                            </span>
                            {s.benar != null && s.total != null && (
                              <span className="ml-2 text-xs text-slate-500">
                                ({s.benar}/{s.total})
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="text-lg font-extrabold tracking-tight text-slate-800">Nilai PBL</div>
            <div className="mt-1 text-sm text-slate-600">Rekap nilai PBL yang sudah kamu kerjakan.</div>

            {pblItems.length === 0 ? (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                Belum ada nilai PBL.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">PBL</th>
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pblItems.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-800">{s.title || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {(() => {
                            const iso = s.tanggal
                            return iso ? new Date(iso).toLocaleDateString('id-ID') : '-'
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            {Number.isFinite(s.nilai) ? s.nilai.toFixed(2) : '0.00'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="text-lg font-extrabold tracking-tight text-slate-800">Nilai Materi/Tugas</div>
            <div className="mt-1 text-sm text-slate-600">Rekap nilai tugas dari materi.</div>

            {materiItems.length === 0 ? (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                Belum ada nilai materi/tugas.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Materi</th>
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materiItems.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-800">{s.title || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {(() => {
                            const iso = s.tanggal
                            return iso ? new Date(iso).toLocaleDateString('id-ID') : '-'
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            {Number.isFinite(s.nilai) ? s.nilai.toFixed(2) : '0.00'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
