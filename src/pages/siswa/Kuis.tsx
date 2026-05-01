import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, kelasAPI, kuisAPI, siswaAPI } from '../../lib/api'
import { getSession } from '../../lib/auth'

type TeacherQuizStatus = 'Aktif' | 'Draft' | 'Selesai' | string

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
  kelas?: any
  kelas_ids?: Array<string | number>
  kelas_list?: Array<{ id?: string | number; nama?: string; tingkat?: string }>
  peserta?: number
  soal?: TeacherQuizQuestion[]
}

type KelasCatalogItem = {
  id: string
  nama: string
  tingkat?: string
}

function extractArrayFromPayload(payload: any): any[] {
  if (Array.isArray(payload)) return payload

  const directKeys = ['data', 'items', 'kuis', 'results']
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

function normalizeKelasValues(raw: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    const out: string[] = []
    for (const k of raw) {
      if (k == null) continue
      if (typeof k === 'string' || typeof k === 'number' || typeof k === 'boolean') {
        const s = String(k).trim()
        if (s) out.push(s)
        continue
      }
      if (typeof k === 'object') {
        const obj: any = k
        if (obj.id != null) out.push(String(obj.id).trim())
        if (obj.kelas_id != null) out.push(String(obj.kelas_id).trim())
        if (typeof obj.nama === 'string') out.push(String(obj.nama).trim())
        if (typeof obj.nama_kelas === 'string') out.push(String(obj.nama_kelas).trim())
        if (typeof obj.name === 'string') out.push(String(obj.name).trim())
        if (typeof obj.tingkat === 'string') out.push(String(obj.tingkat).trim())
        continue
      }
      const s = String(k).trim()
      if (s) out.push(s)
    }
    return out.filter(Boolean)
  }
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return []

    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const parsed = JSON.parse(s)
        if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean)
      } catch {
        // ignore
      }
    }

    if (s.includes(',')) {
      return s
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    }

    return [s]
  }
  if (typeof raw === 'object') {
    const out: string[] = []
    const obj: any = raw
    if (obj.id != null) out.push(String(obj.id).trim())
    if (obj.kelas_id != null) out.push(String(obj.kelas_id).trim())
    if (typeof obj.nama === 'string') out.push(String(obj.nama).trim())
    if (typeof obj.nama_kelas === 'string') out.push(String(obj.nama_kelas).trim())
    if (typeof obj.name === 'string') out.push(String(obj.name).trim())
    if (typeof obj.tingkat === 'string') out.push(String(obj.tingkat).trim())
    return out.filter(Boolean)
  }
  return []
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase()
}

function toUniqueNormalized(tokens: string[]): string[] {
  const set = new Set<string>()
  for (const t of tokens) {
    const n = normalizeToken(t)
    if (n) set.add(n)
  }
  return Array.from(set)
}

function extractTingkatFromKelasName(kelasName: string): string {
  const trimmed = kelasName.trim()
  if (!trimmed) return ''
  const firstToken = trimmed.split(/\s+/)[0]
  return firstToken === 'X' || firstToken === 'XI' || firstToken === 'XII' ? firstToken : ''
}

function isTingkatOnly(kelasNameOrTingkat: string): boolean {
  const v = kelasNameOrTingkat.trim()
  return v === 'X' || v === 'XI' || v === 'XII'
}

function isActiveQuizStatus(status: any): boolean {
  const s = String(status ?? '').trim().toLowerCase()
  return s === 'aktif' || s === 'published' || s === 'active' || s === 'dipublikasikan'
}

function formatKelasLabel(item: TeacherQuizItem): string {
  if (Array.isArray(item.kelas_list) && item.kelas_list.length > 0) {
    const names = item.kelas_list
      .map((k) => (typeof k?.nama === 'string' ? k.nama.trim() : ''))
      .filter(Boolean)
    if (names.length) return names.join(', ')
  }
  const raw = item.kelas_ids ?? item.kelas
  if (Array.isArray(raw)) return raw.map((v) => String(v)).join(', ')
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') return String((raw as any).nama ?? (raw as any).tingkat ?? '-')
  return '-'
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
      // Resolve siswa class (kelas_id/name) similar to Materi.
      const session = getSession()
      const sessionKelasId = session?.kelas_id ? String(session.kelas_id).trim() : ''
      const sessionKelasNameOrTingkat = session?.kelas ? String(session.kelas).trim() : ''

      let siswaKelasId = sessionKelasId
      let siswaKelasNama = sessionKelasNameOrTingkat
      let siswaKelasTingkat = extractTingkatFromKelasName(sessionKelasNameOrTingkat)

      try {
        const me = await authAPI.me()
        if (me.success && me.data) {
          const userData = (me.data.user || me.data) as any
          const meKelasIdRaw = userData.kelas_id ?? userData.kelas?.id ?? userData.kelas_relation?.id
          const meKelasId = meKelasIdRaw != null ? String(meKelasIdRaw).trim() : ''
          if (meKelasId) siswaKelasId = meKelasId

          const meKelasNama =
            (typeof userData.kelas_relation?.nama === 'string' && userData.kelas_relation.nama) ||
            (typeof userData.kelas?.nama === 'string' && userData.kelas.nama) ||
            (typeof userData.kelas === 'string' && userData.kelas) ||
            ''
          if (meKelasNama) siswaKelasNama = meKelasNama

          const meTingkat =
            (typeof userData.kelas_relation?.tingkat === 'string' && userData.kelas_relation.tingkat) ||
            (typeof userData.kelas?.tingkat === 'string' && userData.kelas.tingkat) ||
            extractTingkatFromKelasName(meKelasNama)
          if (meTingkat) siswaKelasTingkat = meTingkat
        }
      } catch {
        // ignore
      }

      if (!siswaKelasId || !siswaKelasNama || isTingkatOnly(siswaKelasNama)) {
        try {
          const selfRes = await siswaAPI.me()
          if (selfRes.success && selfRes.data) {
            const s: any = selfRes.data
            const byIdRaw = s.kelas_id ?? s.kelas_relation?.id ?? s.kelas?.id
            const byId = byIdRaw != null ? String(byIdRaw).trim() : ''
            if (byId) siswaKelasId = byId

            const byNama =
              (typeof s.kelas_relation?.nama === 'string' && s.kelas_relation.nama) ||
              (typeof s.kelas?.nama === 'string' && s.kelas.nama) ||
              (typeof s.kelas === 'string' && s.kelas) ||
              ''
            if (byNama) siswaKelasNama = byNama

            const byTingkat =
              (typeof s.kelas_relation?.tingkat === 'string' && s.kelas_relation.tingkat) ||
              (typeof s.kelas?.tingkat === 'string' && s.kelas.tingkat) ||
              extractTingkatFromKelasName(byNama)
            if (byTingkat) siswaKelasTingkat = byTingkat
          }
        } catch {
          // ignore
        }
      }

      // Load kelas catalog to map ids->names for legacy/loose data.
      let kelasCatalog: KelasCatalogItem[] = []
      try {
        const kelasRes = await kelasAPI.getAll()
        if (kelasRes.success) {
          const payload: any = kelasRes.data
          const arr: any[] = extractArrayFromPayload(payload)
          kelasCatalog = arr
            .filter(Boolean)
            .map((k: any) => ({
              id: String(k.id),
              nama: String(k.nama ?? ''),
              tingkat: typeof k.tingkat === 'string' ? k.tingkat : undefined,
            }))
            .filter((k) => k.id && k.nama)
        }
      } catch {
        // ignore
      }

      if (siswaKelasId && (!siswaKelasNama || isTingkatOnly(siswaKelasNama)) && kelasCatalog.length > 0) {
        const found = kelasCatalog.find((k) => String(k.id) === siswaKelasId)
        if (found?.nama) siswaKelasNama = found.nama
        if (found?.tingkat) siswaKelasTingkat = found.tingkat
        if (!siswaKelasTingkat && found?.nama) siswaKelasTingkat = extractTingkatFromKelasName(found.nama)
      }

      const response = await kuisAPI.getAll()
      if (response.success && response.data) {
        const payload: any = response.data
        const arr: any[] = extractArrayFromPayload(payload)
        const cleaned = arr
          .filter(Boolean)
          .map((q: any) => ({
            id: String(q.id),
            judul: String(q.judul ?? ''),
            status: q.status as TeacherQuizStatus,
            // Backend may return legacy `kelas` and/or many-to-many (`kelas_ids`, `kelas_list`).
            kelas: q.kelas ?? q.kelas_target ?? q.kelas_diujikan,
            kelas_ids: Array.isArray(q.kelas_ids) ? q.kelas_ids : undefined,
            kelas_list: Array.isArray(q.kelas_list) ? q.kelas_list : undefined,
            peserta: typeof q.peserta === 'number' ? q.peserta : undefined,
            soal: Array.isArray(q.soal) ? q.soal : undefined,
          }))

        const siswaHasSpecificClass = !!siswaKelasId || (!!siswaKelasNama && !isTingkatOnly(siswaKelasNama))

        const filteredByKelas = cleaned.filter((q) => {
          if (!siswaKelasId && !siswaKelasNama && !siswaKelasTingkat) return true

          const kelasSource =
            (Array.isArray(q.kelas_ids) && q.kelas_ids.length > 0 ? q.kelas_ids : null) ||
            (Array.isArray(q.kelas_list) && q.kelas_list.length > 0 ? q.kelas_list : null) ||
            q.kelas

          const rawTokens = normalizeKelasValues(kelasSource)
          if (rawTokens.length === 0) return false

          // Legacy quizzes may only be tagged by tingkat (e.g. "X").
          // Allow those to match any student in that tingkat, even if student has a specific class.
          const usingLegacyOnly = !(Array.isArray(q.kelas_ids) && q.kelas_ids.length > 0) && !(Array.isArray(q.kelas_list) && q.kelas_list.length > 0)
          const rawTokensNormalized: string[] = toUniqueNormalized(rawTokens.map((t) => String(t)))
          const legacyIsTingkatOnly = rawTokensNormalized.every((t) => t === 'x' || t === 'xi' || t === 'xii')

          const expandedTokens: string[] = [...rawTokens]
          if (kelasCatalog.length > 0) {
            for (const t of rawTokens) {
              const found = kelasCatalog.find((k) => k.id === String(t))
              if (found?.nama) expandedTokens.push(found.nama)
              if (found?.tingkat) expandedTokens.push(found.tingkat)
              if (!found?.tingkat && found?.nama) expandedTokens.push(extractTingkatFromKelasName(found.nama))
            }
          }

          const tokens = toUniqueNormalized(expandedTokens)
          const idNeedle = siswaKelasId ? normalizeToken(siswaKelasId) : ''
          const namaNeedle = siswaKelasNama ? normalizeToken(siswaKelasNama) : ''
          const tingkatNeedle = siswaKelasTingkat ? normalizeToken(siswaKelasTingkat) : ''

          if (idNeedle && tokens.includes(idNeedle)) return true
          if (namaNeedle && tokens.includes(namaNeedle)) return true

          if (
            usingLegacyOnly &&
            legacyIsTingkatOnly &&
            tingkatNeedle &&
            (rawTokensNormalized as readonly string[]).includes(tingkatNeedle)
          ) {
            return true
          }

          if (!siswaHasSpecificClass && tingkatNeedle) {
            return tokens.some((v) => v === tingkatNeedle || v.startsWith(`${tingkatNeedle} `))
          }

          return false
        })

        const visible = filteredByKelas.filter((q) => isActiveQuizStatus(q.status))
        setItems(visible)
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

  const active = useMemo(() => items.filter((k) => isActiveQuizStatus(k.status)), [items])

  const canStart = (quiz: TeacherQuizItem): boolean => {
    // GET /kuis (list) often does not include `soal`.
    // Questions are fetched in /siswa/kuis/:id (KuisMulai) via Attempt System.
    return !!quiz.id
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
        <div className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
          Kuis Siswa
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">Kuis</h1>
        <p className="mt-2 text-sm text-slate-600">Kuis aktif yang dibuat oleh guru.</p>
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
                  <div className="text-xs font-semibold text-slate-500">Kuis • Kelas {formatKelasLabel(q)}</div>
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
                  onClick={() => {
                    const raw = String(q.id ?? '').trim()
                    navigate(`/siswa/kuis/${raw}`, {
                      state: {
                        quiz: {
                          id: raw,
                          judul: q.judul,
                          status: q.status,
                          batas_waktu: (q as any)?.batas_waktu,
                        },
                      },
                    })
                  }}
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
