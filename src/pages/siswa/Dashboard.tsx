import { useMemo, useState, useEffect } from 'react'
import { getSession } from '../../lib/auth'
import { authAPI, kelasAPI, materiAPI, pblAPI, kuisAPI, nilaiAPI, siswaAPI } from '../../lib/api'

type MateriStatus = 'Aktif' | 'Dipublikasikan' | 'Draft' | string
type MateriItem = {
  id: string
  judul?: string
  title?: string
  kelas?: any
  kelas_ids?: Array<string | number>
  kelas_list?: Array<{ id?: string | number; nama?: string; tingkat?: string }>
  status?: MateriStatus
}

type QuizStatus = 'Aktif' | 'Draft' | 'Selesai'
type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E'
type QuizQuestion = { id: string; text: string; options?: Record<ChoiceKey, string>; answer?: ChoiceKey }
type QuizItem = {
  id: string
  judul?: string
  title?: string
  status?: QuizStatus
  kelas?: any
  kelas_ids?: Array<string | number>
  kelas_list?: Array<{ id?: string | number; nama?: string; tingkat?: string }>
  peserta?: number
  soal?: QuizQuestion[]
  questions?: QuizQuestion[]
}

type KelasCatalogItem = {
  id: string
  nama: string
  tingkat?: string
}

type PblProjectItem = {
  id: string
  judul?: string
  title?: string
  kelas?: any
  kelas_ids?: Array<string | number>
  kelas_list?: Array<{ id?: string | number; nama?: string; tingkat?: string }>
  status?: string
  deadline?: string
}

type PblProgressSummary = {
  projectId: string
  projectTitle: string
  deadline?: string
  totalSintaks: number
  completedSintaks: number
  completionPct: number
}

function extractArrayFromPayload(payload: any): any[] {
  if (Array.isArray(payload)) return payload

  const directKeys = ['data', 'items', 'results', 'rows', 'materi', 'kuis', 'nilai']
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

function isPublishedMateriStatus(status: any): boolean {
  const s = String(status ?? '').trim().toLowerCase()
  return s === 'published' || s === 'dipublikasikan' || s === 'aktif'
}

function isActiveQuizStatus(status: any): boolean {
  const s = String(status ?? '').trim().toLowerCase()
  return s === 'aktif' || s === 'published' || s === 'active' || s === 'dipublikasikan'
}

type Attempt = {
  id: string
  kuis_id?: string
  quizId?: string
  judul_kuis?: string
  title?: string
  tanggal?: string
  date?: string
  created_at?: string
  updated_at?: string
  waktu_selesai?: string
  finished_at?: string
  submitted_at?: string
  project_id?: string
  project_judul?: string
  nilai?: number
  score?: number
  benar?: number
  correct?: number
  total_soal?: number
  total?: number
  email?: string
}

function normalizeQuizAttempts(payload: any): Attempt[] {
  const out: Attempt[] = []

  const pickNumber = (v: any): number | null => {
    if (v == null) return null
    if (typeof v === 'number') return Number.isFinite(v) ? v : null
    if (typeof v === 'string') {
      const trimmed = v.trim().replace('%', '')
      if (!trimmed) return null
      const n = Number(trimmed)
      return Number.isFinite(n) ? n : null
    }
    return null
  }

  const pushQuiz = (a: any) => {
    if (!a) return
    const id = String(a.id ?? '').trim()
    if (!id) return

    const benarValue =
      a.benar ??
      a.correct ??
      a.jumlah_benar ??
      a.correct_count ??
      a.correctAnswers ??
      a.correct_answers
    const totalValue =
      a.total_soal ??
      a.total ??
      a.jumlah_soal ??
      a.total_pertanyaan ??
      a.total_questions ??
      a.question_total

    const rawNilai =
      a.nilai ??
      a.nilai_akhir ??
      a.nilai_kuis ??
      a.score ??
      a.skor ??
      a.skor_akhir ??
      a.score_percent

    const parsedNilai = pickNumber(rawNilai) ?? 0
    const parsedBenar = pickNumber(benarValue)
    const parsedTotal = pickNumber(totalValue)

    let nilaiValue = Number.isFinite(parsedNilai) ? parsedNilai : 0

    // Ratio-style score (0..1) -> percentage.
    if (nilaiValue > 0 && nilaiValue <= 1) {
      nilaiValue = round2(nilaiValue * 100)
    }

    // Some backends return nilai=0 but provide benar/total; derive percentage.
    if ((nilaiValue == null || nilaiValue <= 0) && parsedBenar != null && parsedTotal != null && parsedTotal > 0) {
      const derived = round2((parsedBenar / parsedTotal) * 100)
      if (derived > 0) nilaiValue = derived
    }

    // Clamp to 0..100 for display.
    if (!Number.isFinite(nilaiValue)) nilaiValue = 0
    if (nilaiValue < 0) nilaiValue = 0
    if (nilaiValue > 100) nilaiValue = 100

    out.push({
      id,
      kuis_id: a.kuis_id != null ? String(a.kuis_id) : a.quizId != null ? String(a.quizId) : undefined,
      judul_kuis: typeof a.judul_kuis === 'string' ? a.judul_kuis : typeof a.kuis_judul === 'string' ? a.kuis_judul : typeof a.title === 'string' ? a.title : undefined,
      title: typeof a.title === 'string' ? a.title : undefined,
      tanggal: a.tanggal ?? a.waktu_selesai ?? a.finished_at ?? a.submitted_at ?? a.created_at ?? a.updated_at ?? a.date,
      created_at: a.created_at,
      updated_at: a.updated_at,
      waktu_selesai: a.waktu_selesai,
      finished_at: a.finished_at,
      submitted_at: a.submitted_at,
      nilai: Number.isFinite(nilaiValue) ? nilaiValue : 0,
      score: a.score != null ? Number(a.score) : undefined,
      benar: benarValue != null ? Number(benarValue) : undefined,
      total_soal: totalValue != null ? Number(totalValue) : undefined,
      total: a.total != null ? Number(a.total) : undefined,
      email: typeof a.email === 'string' ? a.email : undefined,
    })
  }

  // Common backend shape: { kuis: [...], pbl: [...] }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const kuisList = Array.isArray((payload as any).kuis) ? (payload as any).kuis : []
    kuisList.forEach(pushQuiz)

    // Some backends return { data: [...] } where kuis/pbl are mixed
    const flat = extractArrayFromPayload(payload)
    if (flat.length > 0) {
      flat.forEach((a: any) => {
        const isPbl = a?.project_id != null || a?.project_judul != null
        if (!isPbl) pushQuiz(a)
      })
    }
  } else if (Array.isArray(payload)) {
    payload.forEach((a: any) => {
      const isPbl = a?.project_id != null || a?.project_judul != null
      if (!isPbl) pushQuiz(a)
    })
  }

  return out.sort((a, b) => {
    const ad = a.tanggal ? Date.parse(a.tanggal) : 0
    const bd = b.tanggal ? Date.parse(b.tanggal) : 0
    return bd - ad
  })
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

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function formatTanggalPendek(iso?: string): string | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  try {
    return new Date(ms).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return null
  }
}

// Hook untuk load data dari API
function useApiData() {
  const session = useMemo(() => getSession(), [])
  const [materiItems, setMateriItems] = useState<MateriItem[]>([])
  const [kuisItems, setKuisItems] = useState<QuizItem[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [pblProgress, setPblProgress] = useState<PblProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      // Resolve siswa kelas (id/nama/tingkat) similar to Materi/Kuis pages.
      const sessionKelasId = session?.kelas_id ? String(session.kelas_id).trim() : ''
      const sessionKelasNameOrTingkat = session?.kelas ? String(session.kelas).trim() : ''

      let siswaKelasId = sessionKelasId
      let siswaKelasNama = sessionKelasNameOrTingkat
      let siswaKelasTingkat = extractTingkatFromKelasName(sessionKelasNameOrTingkat)

      try {
        const meResponse = await authAPI.me()
        if (meResponse.success && meResponse.data) {
          const userData = (meResponse.data.user || meResponse.data) as any
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

      const siswaHasSpecificClass = !!siswaKelasId || (!!siswaKelasNama && !isTingkatOnly(siswaKelasNama))

      // Load materi dari API (payload shape varies: array, {data:[]}, {data:{data:[]}})
      try {
        const materiRes = await materiAPI.getAll()
        if (materiRes.success) {
          const arr = extractArrayFromPayload(materiRes.data)
          const cleaned = arr
            .filter(Boolean)
            .map((m: any) => ({
              id: String(m.id),
              judul: typeof m.judul === 'string' ? m.judul : undefined,
              title: typeof m.title === 'string' ? m.title : undefined,
              kelas: m.kelas,
              kelas_ids: Array.isArray(m.kelas_ids) ? m.kelas_ids : undefined,
              kelas_list: Array.isArray(m.kelas_list) ? m.kelas_list : undefined,
              status: m.status as MateriStatus,
            }))

          const filteredByKelas = cleaned.filter((m: MateriItem) => {
            if (!siswaKelasId && !siswaKelasNama && !siswaKelasTingkat) return true

            const kelasSource =
              (Array.isArray(m.kelas_ids) && m.kelas_ids.length > 0 ? m.kelas_ids : null) ||
              (Array.isArray(m.kelas_list) && m.kelas_list.length > 0 ? m.kelas_list : null) ||
              m.kelas

            const rawTokens = normalizeKelasValues(kelasSource)
            if (rawTokens.length === 0) return false

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

            if (!siswaHasSpecificClass && tingkatNeedle) {
              const rawTingkatTokens = expandedTokens
                .map((v) => extractTingkatFromKelasName(String(v)))
                .filter(Boolean)
              if (rawTingkatTokens.length === 0) return false
              const allSameTingkat = rawTingkatTokens.every((t) => normalizeToken(t) === tingkatNeedle)
              if (!allSameTingkat) return false
              return tokens.some((v) => v === tingkatNeedle || v.startsWith(`${tingkatNeedle} `))
            }

            return false
          })

          const visible = filteredByKelas.filter((m) => isPublishedMateriStatus(m.status))
          setMateriItems(visible)
        }
      } catch (err) {
        setMateriItems(loadJsonArray<MateriItem>('jk_teacher_materi'))
      }

      // Load kuis dari API (payload shape varies)
      try {
        const kuisRes = await kuisAPI.getAll()
        if (kuisRes.success) {
          const arr = extractArrayFromPayload(kuisRes.data)
          const cleaned = arr
            .filter(Boolean)
            .map((q: any) => ({
              id: String(q.id),
              judul: typeof q.judul === 'string' ? q.judul : undefined,
              title: typeof q.title === 'string' ? q.title : undefined,
              status: q.status as QuizStatus,
              kelas: q.kelas,
              kelas_ids: Array.isArray(q.kelas_ids) ? q.kelas_ids : undefined,
              kelas_list: Array.isArray(q.kelas_list) ? q.kelas_list : undefined,
              peserta: typeof q.peserta === 'number' ? q.peserta : undefined,
              soal: Array.isArray(q.soal) ? q.soal : undefined,
              questions: Array.isArray(q.questions) ? q.questions : undefined,
            }))

          const filteredByKelas = cleaned.filter((q: QuizItem) => {
            if (!siswaKelasId && !siswaKelasNama && !siswaKelasTingkat) return true

            const kelasSource =
              (Array.isArray(q.kelas_ids) && q.kelas_ids.length > 0 ? q.kelas_ids : null) ||
              (Array.isArray(q.kelas_list) && q.kelas_list.length > 0 ? q.kelas_list : null) ||
              q.kelas

            const rawTokens = normalizeKelasValues(kelasSource)
            if (rawTokens.length === 0) return false

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

            if (!siswaHasSpecificClass && tingkatNeedle) {
              const rawTingkatTokens = expandedTokens
                .map((v) => extractTingkatFromKelasName(String(v)))
                .filter(Boolean)
              if (rawTingkatTokens.length === 0) return false
              const allSameTingkat = rawTingkatTokens.every((t) => normalizeToken(t) === tingkatNeedle)
              if (!allSameTingkat) return false
              return tokens.some((v) => v === tingkatNeedle || v.startsWith(`${tingkatNeedle} `))
            }

            return false
          })

          const visible = filteredByKelas.filter((k) => isActiveQuizStatus((k as any).status))
          setKuisItems(visible)
        }
      } catch (err) {
        setKuisItems(loadJsonArray<QuizItem>('jk_teacher_kuis'))
      }

      // Load nilai dari API
      try {
        const nilaiRes = await nilaiAPI.getNilai({ type: 'all' })
        if (nilaiRes.success) {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.debug('[Dashboard] nilai payload:', nilaiRes.data)
          }
          setAttempts(normalizeQuizAttempts(nilaiRes.data))
        }
      } catch (err) {
        const local = loadJsonArray<Attempt>('jk_student_scores')
        const email = session?.email
        const filtered = email ? local.filter((x: any) => !x?.email || x.email === email) : local
        setAttempts(normalizeQuizAttempts(filtered))
      }

      // Load progress PBL (pilih project yang relevan dan bisa diakses)
      try {
        const pblRes = await pblAPI.getAll()
        if (pblRes.success) {
          const arr = extractArrayFromPayload(pblRes.data)
          const cleaned: PblProjectItem[] = arr
            .filter(Boolean)
            .map((p: any) => ({
              id: String(p.id),
              judul: typeof p.judul === 'string' ? p.judul : undefined,
              title: typeof p.title === 'string' ? p.title : undefined,
              kelas: p.kelas,
              kelas_ids: Array.isArray(p.kelas_ids) ? p.kelas_ids : undefined,
              kelas_list: Array.isArray(p.kelas_list) ? p.kelas_list : undefined,
              status: typeof p.status === 'string' ? p.status : undefined,
              deadline: typeof p.deadline === 'string' ? p.deadline : undefined,
            }))
            .filter((p) => p.id)

          const filteredByKelas = cleaned.filter((p: PblProjectItem) => {
            if (!siswaKelasId && !siswaKelasNama && !siswaKelasTingkat) return true

            const kelasSource =
              (Array.isArray(p.kelas_ids) && p.kelas_ids.length > 0 ? p.kelas_ids : null) ||
              (Array.isArray(p.kelas_list) && p.kelas_list.length > 0 ? p.kelas_list : null) ||
              p.kelas

            const rawTokens = normalizeKelasValues(kelasSource)
            if (rawTokens.length === 0) return false

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

            if (!siswaHasSpecificClass && tingkatNeedle) {
              const rawTingkatTokens = expandedTokens
                .map((v) => extractTingkatFromKelasName(String(v)))
                .filter(Boolean)
              if (rawTingkatTokens.length === 0) return false
              const allSameTingkat = rawTingkatTokens.every((t) => normalizeToken(t) === tingkatNeedle)
              if (!allSameTingkat) return false
              return tokens.some((v) => v === tingkatNeedle || v.startsWith(`${tingkatNeedle} `))
            }

            return false
          })

          const sorted = [...filteredByKelas].sort((a, b) => {
            const ad = a.deadline ? Date.parse(a.deadline) : Number.POSITIVE_INFINITY
            const bd = b.deadline ? Date.parse(b.deadline) : Number.POSITIVE_INFINITY
            return ad - bd
          })

          let picked: PblProgressSummary | null = null
          for (const project of sorted.slice(0, 6)) {
            try {
              const progressRes = await pblAPI.getProgress(project.id)
              if (!progressRes?.success || !progressRes.data) continue
              const title = String(project.judul ?? project.title ?? 'Project PBL').trim() || 'Project PBL'

              const totalSintaks = Number(progressRes.data.total_sintaks ?? 0)
              const completedSintaks = Number(progressRes.data.completed_sintaks ?? 0)
              const completionPctRaw = Number(progressRes.data.completion_percentage ?? 0)
              const completionPct = Number.isFinite(completionPctRaw)
                ? Math.min(100, Math.max(0, Math.round(completionPctRaw)))
                : 0

              picked = {
                projectId: project.id,
                projectTitle: title,
                deadline: project.deadline,
                totalSintaks: Number.isFinite(totalSintaks) ? totalSintaks : 0,
                completedSintaks: Number.isFinite(completedSintaks) ? completedSintaks : 0,
                completionPct,
              }
              break
            } catch {
              // ignore and try next project (e.g. 403 jika belum terdaftar kelompok)
            }
          }

          setPblProgress(picked)
        }
      } catch {
        setPblProgress(null)
      }

      setLoading(false)
    }
    loadData()
  }, [])

  return { materiItems, kuisItems, attempts, pblProgress, loading }
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

function QuizTrendChart({ points }: { points: Array<{ label: string; value: number }> }) {
  const width = 360
  const height = 170
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
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
      <line className="text-slate-200" x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="currentColor" />
      <line className="text-slate-200" x1={paddingX} y1={paddingY} x2={paddingX} y2={height - paddingY} stroke="currentColor" />

      <polyline className="text-amber-500" points={linePoints} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

      {points.map((p, i) => {
        const x = paddingX + i * xStep
        const y = paddingY + (height - paddingY * 2) * (1 - (p.value - min) / range)
        return <circle key={`${p.label}-${i}`} className="text-amber-500" cx={x} cy={y} r={4} fill="currentColor" />
      })}

      {/* x-axis labels aligned to point positions */}
      {points.map((p, i) => {
        const x = paddingX + i * xStep
        return (
          <text
            key={`x-${p.label}-${i}`}
            x={x}
            y={height - 4}
            textAnchor="middle"
            className="text-slate-500"
            fontSize="10"
            fontWeight={600}
          >
            {p.label}
          </text>
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
  const { materiItems, kuisItems, attempts, pblProgress, loading } = useApiData()

  const materiCount = useMemo(() => {
    // `materiItems` already filtered to what siswa can see.
    return materiItems.length
  }, [materiItems])

  const kuisAktifCount = useMemo(() => {
    // `kuisItems` already filtered to what siswa can see.
    return kuisItems.length
  }, [kuisItems])

  const avgScore = useMemo(() => {
    if (attempts.length === 0) return null
    const sum = attempts.reduce((acc, a) => {
      const score = a.nilai ?? a.score ?? 0
      return acc + (Number.isFinite(score) ? score : 0)
    }, 0)
    return round2(sum / attempts.length)
  }, [attempts])

  const pblBadge = useMemo(() => {
    if (!pblProgress) return null
    return Number.isFinite(pblProgress.completionPct) ? pblProgress.completionPct : null
  }, [pblProgress])

  const lastScores = useMemo(() => {
    const vals = attempts
      .filter((a) => {
        const score = a.nilai ?? a.score ?? 0
        return Number.isFinite(score)
      })
      .slice(0, 4)
      .map((a) => a.nilai ?? a.score ?? 0)
    while (vals.length < 4) vals.push(0)
    return vals
  }, [attempts])

  const recentQuizPoints = useMemo(() => {
    // Keep it simple and unambiguous: show 7 most recent quiz attempts.
    // `attempts` is already sorted (newest -> oldest). Reverse the 7-window so K1 is earliest.
    const window = attempts.slice(0, 7).reverse()

    // If fewer than 7 attempts, pad *after* the real data.
    const padded: Array<any | null> = window.length >= 7 ? window : [...window, ...Array(7 - window.length).fill(null)]
    return padded.map((a: any, idx: number) => {
      const value = a ? round2(Number(a.nilai ?? a.score ?? 0)) : 0
      return { label: `K${idx + 1}`, value: Number.isFinite(value) ? value : 0 }
    })
  }, [attempts])

  const maxRecent = useMemo(() => Math.max(...recentQuizPoints.map((p) => p.value), 0), [recentQuizPoints])

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
          <p className="text-center text-slate-500">Memuat dasbor...</p>
        </div>
      ) : (
        <>
          <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
            <div className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
              Dasbor Siswa
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
              Selamat datang{name ? `, ${name}` : ''}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {session?.kelas && session?.jurusan 
                ? `Kelas ${session.kelas} - ${session.jurusan}`
                : 'Tampilan awal siswa.'}
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
              <div className="text-sm font-extrabold text-slate-800">Progres PBL</div>
              <div className="mt-1 text-xs text-slate-500">Ringkasan progres sintaks kelompokmu</div>
            </div>
            <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              {pblBadge === null ? '—' : `${pblBadge}%`}
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-slate-700">
                    {pblProgress ? pblProgress.projectTitle : 'Belum ada project PBL untuk kelasmu'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {pblProgress
                      ? `${pblProgress.completedSintaks}/${pblProgress.totalSintaks} sintaks selesai`
                      : 'Jika guru sudah membuat PBL dan kamu masuk kelompok, progres akan tampil di sini.'}
                  </div>
                </div>
                <div className="shrink-0 text-[11px] font-semibold text-slate-600">
                  {(() => {
                    const t = pblProgress?.deadline ? formatTanggalPendek(pblProgress.deadline) : null
                    return t ? `Deadline: ${t}` : ''
                  })()}
                </div>
              </div>

              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${Math.min(100, Math.max(0, pblProgress?.completionPct ?? 0))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-extrabold text-slate-800">Nilai Kuis Terakhir</div>
              <div className="mt-1 text-xs text-slate-500">Tren nilai kuis (7 kuis terakhir)</div>
            </div>
            <div className="text-xs font-semibold text-slate-600">Max: {recentQuizPoints.length >= 2 ? maxRecent : maxLast}</div>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            {recentQuizPoints.length >= 2 ? (
              <>
                <QuizTrendChart points={recentQuizPoints} />
              </>
            ) : (
              <BarChart values={lastScores} />
            )}
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
