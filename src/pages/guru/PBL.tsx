import { useEffect, useState } from 'react'
import { pblAPI, jurusanAPI, authAPI, kelasAPI, siswaAPI, formatApiErrorAlert } from '../../lib/api'
import { Icon } from '../../components/ui/Icon'
import ResponsiveSelect from '../../components/ui/ResponsiveSelect'

type StatusPBL = 'Aktif' | 'Draft' | 'Selesai'

type ProjectPBL = {
  id: string
  judul: string
  masalah: string
  tujuan_pembelajaran: string
  panduan: string
  referensi?: string
  // Legacy (tingkat) - masih ada di beberapa response lama
  kelas?: string
  // Backend terbaru (many-to-many)
  kelas_ids?: Array<string | number>
  kelas_list?: Array<{ id?: string | number; nama?: string; tingkat?: string }>
  jurusan_id: string
  status: StatusPBL
  deadline: string
}

type Jurusan = {
  id: string
  nama: string
  nama_jurusan?: string
}

type Kelompok = {
  id: string
  nama_kelompok: string
  studi_kasus?: string
  anggota_kelompok?: string | number[]  // Support both text and array
  anggota?: string[] | number[]  // Backend returns array of siswa IDs
  siswa?: Array<{ id: number; nama: string; nis?: string }>  // Populated by backend
}

type Kelas = {
  id: string | number
  nama: string
  tingkat: string
}

type Submission = {
  id: string
  project_id: string
  kelompok_id: string
  kelompok?: {
    id: string
    nama_kelompok: string
    anggota?: Array<string | number>
  }
  file_name: string
  file_path: string
  file_size: number
  catatan?: string
  nilai?: number
  feedback?: string
  submitted_at: string
}

type JobdeskRole = 'Ketua' | 'Penyelidik' | 'Analis' | 'Notulis'

type JobdeskItem = {
  siswa_id: string
  role: JobdeskRole
}

function buildStorageUrl(pathLike: unknown): string | null {
  const raw = String(pathLike ?? '').trim()
  const lowered = raw.toLowerCase()
  if (!raw || lowered === 'undefined' || lowered === 'null') return null

  // If backend already returns absolute URL, just use it.
  if (/^https?:\/\//i.test(raw)) return raw

  const apiBase = String(import.meta.env.VITE_API_URL ?? '').trim()
  let origin = ''
  try {
    // Works for absolute and relative API URLs.
    origin = new URL(apiBase || '/api', window.location.origin).origin
  } catch {
    origin = window.location.origin
  }

  // If backend returns an absolute path like /storage/..., join with origin.
  if (raw.startsWith('/')) return `${origin}${raw}`

  // If backend returns storage/... (already includes storage prefix)
  if (/^storage\//i.test(raw)) return `${origin}/${raw}`

  return `${origin}/storage/${raw}`
}

type KontribusiIndividu = {
  id: string
  kelompok_id: string
  sintaks_id: string
  sintaks_urutan?: number
  siswa_id: string
  catatan: string
  file_path: string | null
  submitted_at: string | null
}

function extractCreatedKelompokId(payload: any): string {
  const candidates = [
    payload?.data?.id,
    payload?.data?.data?.id,
    payload?.data?.kelompok?.id,
    payload?.data?.data?.kelompok?.id,
    payload?.id,
  ]
  for (const c of candidates) {
    const id = c != null ? String(c).trim() : ''
    if (id) return id
  }
  return ''
}

type TeacherLeaderboardRow = {
  kelompok_id: string
  kelompok_name: string
  completion_percentage: number
  completed_sintaks: number
  total_sintaks: number
  last_completed_at_ms: number | null
  bonus_fastest: number
  skor: number
}

type TeacherLeaderboardData = {
  rows: TeacherLeaderboardRow[]
  fastestByPhase: Array<{
    urutan: number
    judul: string
    top3: Array<{ kelompok_id: string; kelompok_name: string; submitted_at_ms: number }>
  }>
}

function safeParseDateMs(value: unknown): number | null {
  if (!value) return null
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : null
  }
  const s = String(value).trim()
  if (!s) return null
  const ms = new Date(s).getTime()
  return Number.isFinite(ms) ? ms : null
}

function formatShortDateTimeId(ms: number): string {
  try {
    return new Date(ms).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

function computeTeacherLeaderboard(params: {
  phases: Array<{ urutan: number; judul: string }>
  kelompokList: Kelompok[]
  submissionProgress: Record<string, any>
}): TeacherLeaderboardData {
  const { phases, kelompokList, submissionProgress } = params
  const kelompokNameById = new Map<string, string>()
  for (const k of kelompokList || []) {
    const id = String((k as any)?.id ?? '').trim()
    if (!id) continue
    const name = String((k as any)?.nama_kelompok ?? 'Kelompok').trim() || 'Kelompok'
    kelompokNameById.set(id, name)
  }

  // Collect completion timestamps per phase, per kelompok
  const phaseCompletions: Record<number, Array<{ kelompok_id: string; submitted_at_ms: number }>> = {}
  for (const phase of phases) phaseCompletions[phase.urutan] = []

  const kelompokIds = new Set<string>([
    ...Object.keys(submissionProgress || {}).map((k) => String(k)),
    ...(kelompokList || []).map((k: any) => String(k?.id)).filter(Boolean),
  ])

  const lastCompletedAtByKelompok = new Map<string, number | null>()
  for (const kelompokId of kelompokIds) {
    const progress = (submissionProgress as any)?.[kelompokId]
    const items = Array.isArray(progress?.progress) ? progress.progress : []
    let lastMs: number | null = null

    for (const phase of phases) {
      const hit =
        items.find((p: any) => Number(p?.urutan) === Number(phase.urutan)) ??
        items.find((p: any) => String(p?.sintaks_id) === String(phase.urutan))
      const completed = Boolean(hit?.completed)
      const submittedMs = safeParseDateMs(hit?.submitted_at)
      if (completed && submittedMs != null) {
        phaseCompletions[phase.urutan].push({ kelompok_id: kelompokId, submitted_at_ms: submittedMs })
        if (lastMs == null || submittedMs > lastMs) lastMs = submittedMs
      }
    }

    lastCompletedAtByKelompok.set(kelompokId, lastMs)
  }

  // Determine top 3 fastest per phase, and compute bonuses
  const bonusByKelompok = new Map<string, number>()
  const fastestByPhase: TeacherLeaderboardData['fastestByPhase'] = []

  for (const phase of phases) {
    const entries = (phaseCompletions[phase.urutan] || [])
      .slice()
      .sort((a, b) => a.submitted_at_ms - b.submitted_at_ms)

    // Deduplicate in case backend sends duplicate progress rows
    const topUnique: Array<{ kelompok_id: string; submitted_at_ms: number }> = []
    const seen = new Set<string>()
    for (const e of entries) {
      if (seen.has(e.kelompok_id)) continue
      seen.add(e.kelompok_id)
      topUnique.push(e)
      if (topUnique.length >= 3) break
    }

    const scored = topUnique.map((e, idx) => {
      const bonus = idx === 0 ? 3 : idx === 1 ? 2 : 1
      bonusByKelompok.set(e.kelompok_id, (bonusByKelompok.get(e.kelompok_id) || 0) + bonus)
      return {
        kelompok_id: e.kelompok_id,
        kelompok_name: kelompokNameById.get(e.kelompok_id) || `Kelompok ${e.kelompok_id}`,
        submitted_at_ms: e.submitted_at_ms,
      }
    })

    fastestByPhase.push({
      urutan: phase.urutan,
      judul: phase.judul,
      top3: scored,
    })
  }

  const rows: TeacherLeaderboardRow[] = Array.from(kelompokIds)
    .map((kelompokId) => {
      const progress = (submissionProgress as any)?.[kelompokId]
      const completion_percentage = Number(progress?.completion_percentage ?? 0) || 0
      const completed_sintaks = Number(progress?.completed_sintaks ?? 0) || 0
      const total_sintaks = Number(progress?.total_sintaks ?? phases.length) || phases.length
      const last_completed_at_ms = lastCompletedAtByKelompok.get(kelompokId) ?? null
      const bonus_fastest = bonusByKelompok.get(kelompokId) || 0
      const skor = completion_percentage + bonus_fastest
      return {
        kelompok_id: kelompokId,
        kelompok_name: kelompokNameById.get(kelompokId) || `Kelompok ${kelompokId}`,
        completion_percentage,
        completed_sintaks,
        total_sintaks,
        last_completed_at_ms,
        bonus_fastest,
        skor,
      }
    })
    .sort((a, b) => {
      if (b.skor !== a.skor) return b.skor - a.skor
      if (b.completion_percentage !== a.completion_percentage) return b.completion_percentage - a.completion_percentage
      // tie-breaker: earlier finish wins (if both have a finish timestamp)
      if (a.last_completed_at_ms != null && b.last_completed_at_ms != null) return a.last_completed_at_ms - b.last_completed_at_ms
      if (a.last_completed_at_ms != null) return -1
      if (b.last_completed_at_ms != null) return 1
      return a.kelompok_name.localeCompare(b.kelompok_name)
    })

  return { rows, fastestByPhase }
}

function formatKelasLabel(project: ProjectPBL, kelasList: Kelas[], jurusanList: Jurusan[]): string {
  const list = Array.isArray(project.kelas_list) ? project.kelas_list : []
  if (list.length > 0) {
    const names = list
      .map((k) => (typeof k?.nama === 'string' ? k.nama.trim() : ''))
      .filter(Boolean)
    if (names.length > 0) return names.join(', ')
  }

  const ids = Array.isArray(project.kelas_ids) ? project.kelas_ids : []
  if (ids.length > 0 && Array.isArray(kelasList) && kelasList.length > 0) {
    const names = ids
      .map((id) => {
        const hit = kelasList.find((k) => String(k.id) === String(id))
        return typeof hit?.nama === 'string' ? hit.nama.trim() : ''
      })
      .filter(Boolean)
    if (names.length > 0) return names.join(', ')
  }

  const raw = String(project.kelas ?? '').trim()
  if (!raw) return '-'

  const lowered = raw.toLowerCase()
  const isTingkatOnly = lowered === 'x' || lowered === 'xi' || lowered === 'xii'
  if (!isTingkatOnly) return raw

  const jurusan = (Array.isArray(jurusanList) ? jurusanList : []).find((j) => String(j.id) === String(project.jurusan_id))
  const jurusanName = String(jurusan?.nama_jurusan ?? jurusan?.nama ?? '').trim()
  return jurusanName ? `${raw} ${jurusanName}` : `${raw} (tingkat)`
}

function extractArrayFromPayload(value: any): any[] {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  const directKeys = ['data', 'items', 'results', 'rows', 'submissions', 'kelompok', 'sintaks', 'kontribusi', 'nilai_individu']
  for (const key of directKeys) {
    if (Array.isArray((value as any)[key])) return (value as any)[key]
  }
  // Common Laravel pagination/resource wrappers
  if (value.data && Array.isArray(value.data)) return value.data
  if (value.data && typeof value.data === 'object' && Array.isArray((value.data as any).data)) return (value.data as any).data
  return []
}

function normalizeJobdeskRole(value: unknown): JobdeskRole | null {
  const s = String(value ?? '').trim().toLowerCase()
  if (s === 'ketua') return 'Ketua'
  if (s === 'penyelidik') return 'Penyelidik'
  if (s === 'analis') return 'Analis'
  if (s === 'notulis') return 'Notulis'
  return null
}

function buildJobdeskMap(items: Array<{ siswa_id: unknown; role: unknown }>, normalizeKey: (v: unknown) => string): Record<string, JobdeskRole> {
  const out: Record<string, JobdeskRole> = {}
  for (const it of items || []) {
    const key = normalizeKey((it as any)?.siswa_id)
    const role = normalizeJobdeskRole((it as any)?.role)
    if (!key || !role) continue
    out[key] = role
  }
  return out
}

export default function PBL() {
  // 5 Fase standar Problem-Based Learning
  const DEFAULT_PBL_PHASES = [
    {
      urutan: 1,
      judul: 'Orientasi pada Masalah',
      instruksi: 'Siswa mengamati dan memahami permasalahan yang diberikan. Identifikasi poin-poin penting dari masalah, diskusikan bersama kelompok, dan rumuskan pertanyaan-pertanyaan kunci yang perlu dijawab.',
    },
    {
      urutan: 2,
      judul: 'Organisasi Belajar',
      instruksi: 'Susun rencana belajar kelompok. Tentukan pembagian tugas, jadwal kerja, sumber belajar yang akan digunakan, dan strategi penyelesaian masalah.',
    },
    {
      urutan: 3,
      judul: 'Penyelidikan',
      instruksi: 'Lakukan investigasi dan pengumpulan data/informasi sesuai pembagian tugas. Catat hasil temuan, referensi yang digunakan, dan analisis data yang didapat.',
    },
    {
      urutan: 4,
      judul: 'Mengembangkan Hasil Karya',
      instruksi: 'Kembangkan solusi atau produk berdasarkan hasil penyelidikan. Buat laporan, presentasi, prototipe, atau bentuk karya lainnya sesuai instruksi guru.',
    },
    {
      urutan: 5,
      judul: 'Evaluasi Proses',
      instruksi: 'Lakukan refleksi dan evaluasi terhadap proses dan hasil kerja kelompok. Identifikasi kelebihan, kekurangan, dan pelajaran yang didapat dari seluruh proses PBL.',
    },
  ]

  const DISPLAY_SINTAKS = DEFAULT_PBL_PHASES.map((p) => ({
    id: `phase-${p.urutan}`,
    urutan: p.urutan,
    judul: p.judul,
    nama_fase: p.judul,
    deskripsi: '',
    instruksi: p.instruksi,
  }))

  const [projects, setProjects] = useState<ProjectPBL[]>([])
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([])
  const [kelasList, setKelasList] = useState<Kelas[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingProject, setEditingProject] = useState<ProjectPBL | null>(null)
  const [selectedProject, setSelectedProject] = useState<ProjectPBL | null>(null)
  const [viewMode, setViewMode] = useState<'kelompok' | 'submission' | null>(null)
  const [submissionList, setSubmissionList] = useState<Submission[]>([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [nilaiFormData, setNilaiFormData] = useState<Record<string, { nilai: string; feedback: string }>>({})
  const [savingNilai, setSavingNilai] = useState<string | null>(null)
  const [nilaiIndividuDraftByKelompokId, setNilaiIndividuDraftByKelompokId] = useState<Record<string, Record<string, string>>>({})
  const [savingNilaiIndividu, setSavingNilaiIndividu] = useState<string | null>(null)
  const [submissionProgress, setSubmissionProgress] = useState<Record<string, any>>({})
  const [expandedSintaks, setExpandedSintaks] = useState<string[]>([])
  const [kelompokList, setKelompokList] = useState<Kelompok[]>([])
  const [selectedResultKelompokId, setSelectedResultKelompokId] = useState('')
  const [showKelompokForm, setShowKelompokForm] = useState(false)

  const [sintaksIdToUrutan, setSintaksIdToUrutan] = useState<Record<string, number>>({})
  const [editingKelompok, setEditingKelompok] = useState<Kelompok | null>(null)
  const [siswaList, setSiswaList] = useState<Array<{ id: number | string; nama: string; nis?: string; kelas?: string }>>([])
  const [expandedKelompok, setExpandedKelompok] = useState<string[]>([])

  const [jobdeskByKelompokId, setJobdeskByKelompokId] = useState<Record<string, Record<string, JobdeskRole>>>({})
  const [kontribusiByKelompokId, setKontribusiByKelompokId] = useState<Record<string, KontribusiIndividu[]>>({})
  const [jobdeskDraft, setJobdeskDraft] = useState<Record<string, JobdeskRole>>({})

  const [formData, setFormData] = useState({
    judul: '',
    masalah: '',
    tujuan_pembelajaran: '',
    panduan: '',
    referensi: '',
    kelas_ids: [] as Array<string | number>,
    jurusan_id: '',
    status: 'Draft' as StatusPBL,
    deadline: ''
  })

  const [kelompokFormData, setKelompokFormData] = useState<{
    nama_kelompok: string
    studi_kasus: string
    anggota_ids: (string | number)[]
    ketua_id: string | number | ''
  }>({
    nama_kelompok: '',
    studi_kasus: '',
    anggota_ids: [],
    ketua_id: ''
  })

  function normalizeSiswaIdForForm(value: unknown): string | number | '' {
    if (typeof value === 'number' && Number.isFinite(value)) return `siswa-${value}`
    const s = String(value ?? '').trim()
    if (!s) return ''
    const match = s.match(/^siswa-(\d+)$/i)
    if (match?.[1]) return `siswa-${match[1]}`
    if (/^\d+$/.test(s)) return `siswa-${s}`
    return s
  }

  function getSiswaNameByIdKey(idKey: string): string {
    const hit = siswaList.find((s) => normalizeSiswaIdKey(s.id) === idKey)
    return String(hit?.nama ?? idKey)
  }

  async function loadJobdeskBestEffort(pblId: string, kelompokRows: Array<{ id: unknown }>) {
    try {
      const ids = (kelompokRows || [])
        .map((k: any) => String(k?.id ?? '').trim())
        .filter(Boolean)

      if (ids.length === 0) return

      const results = await Promise.allSettled(ids.map((kelompokId) => pblAPI.getJobdesk(pblId, kelompokId)))
      const next: Record<string, Record<string, JobdeskRole>> = {}

      for (let i = 0; i < ids.length; i++) {
        const kelompokId = ids[i]
        const r = results[i]
        if (r.status !== 'fulfilled') continue
        const res: any = r.value
        if (!res?.success) continue

        const jobdeskArr =
          Array.isArray(res?.data?.jobdesk) ? res.data.jobdesk : Array.isArray(res?.data?.data?.jobdesk) ? res.data.data.jobdesk : []
        if (!Array.isArray(jobdeskArr) || jobdeskArr.length === 0) continue
        next[kelompokId] = buildJobdeskMap(jobdeskArr, normalizeSiswaIdKey)
      }

      if (Object.keys(next).length > 0) {
        setJobdeskByKelompokId((prev) => ({ ...prev, ...next }))
      }
    } catch (e: any) {
      // Jika endpoint belum ada (404), abaikan.
      if (e?.status === 404) return
      console.warn('Gagal memuat jobdesk (best-effort):', e)
    }
  }

  async function loadKontribusiBestEffort(pblId: string, kelompokIds: string[]) {
    try {
      const ids = (kelompokIds || []).map((v) => String(v).trim()).filter(Boolean)
      if (ids.length === 0) return

      const results = await Promise.allSettled(ids.map((kelompokId) => pblAPI.getKelompokKontribusi(pblId, kelompokId)))
      const next: Record<string, KontribusiIndividu[]> = {}

      for (let i = 0; i < ids.length; i++) {
        const kelompokId = ids[i]
        const r = results[i]
        if (r.status !== 'fulfilled') continue
        const res: any = r.value
        if (!res?.success) continue

        const arr = extractArrayFromPayload(res?.data)
        const rows = arr
          .map((raw: any) => {
            if (!raw || typeof raw !== 'object') return null
            const id = raw.id != null ? String(raw.id) : ''
            const siswa_id = raw.siswa_id != null ? String(raw.siswa_id) : ''
            const sintaks_id = raw.sintaks_id != null ? String(raw.sintaks_id) : ''
            const kelompok_id = raw.kelompok_id != null ? String(raw.kelompok_id) : kelompokId
            if (!id || !siswa_id || !sintaks_id) return null
            const sintaks_urutan =
              typeof raw.sintaks_urutan === 'number'
                ? raw.sintaks_urutan
                : typeof raw.sintaks_urutan === 'string' && raw.sintaks_urutan.trim().length > 0 && !Number.isNaN(Number(raw.sintaks_urutan))
                  ? Number(raw.sintaks_urutan)
                  : undefined
            return {
              id,
              kelompok_id,
              sintaks_id,
              sintaks_urutan,
              siswa_id,
              catatan: typeof raw.catatan === 'string' ? raw.catatan : String(raw.catatan ?? ''),
              file_path: raw.file_path == null ? null : String(raw.file_path),
              submitted_at: raw.submitted_at == null ? null : String(raw.submitted_at),
            } satisfies KontribusiIndividu
          })
          .filter(Boolean) as KontribusiIndividu[]

        // Simpan juga array kosong supaya UI bisa menampilkan state "belum ada kontribusi".
        next[kelompokId] = rows
      }

      if (Object.keys(next).length > 0) {
        setKontribusiByKelompokId((prev) => ({ ...prev, ...next }))
      }
    } catch (e: any) {
      if (e?.status === 404) return
      console.warn('Gagal memuat kontribusi individu (best-effort):', e)
    }
  }

  async function loadNilaiIndividuBestEffort(pblId: string, kelompokIds: string[]) {
    try {
      const ids = (kelompokIds || []).map((v) => String(v).trim()).filter(Boolean)
      if (ids.length === 0) return

      const results = await Promise.allSettled(ids.map((kelompokId) => pblAPI.getNilaiIndividuKelompok(pblId, kelompokId)))
      const nextDraft: Record<string, Record<string, string>> = {}

      for (let i = 0; i < ids.length; i++) {
        const kelompokId = ids[i]
        const r = results[i]
        if (r.status !== 'fulfilled') continue
        const res: any = r.value
        if (!res?.success) continue
        const arr = extractArrayFromPayload(res?.data)
        if (!Array.isArray(arr) || arr.length === 0) {
          // Record empty so UI doesn't try to show defaults.
          nextDraft[kelompokId] = {}
          continue
        }

        const map: Record<string, string> = {}
        for (const row of arr) {
          const key = normalizeSiswaIdKey((row as any)?.siswa_id)
          const nilai = (row as any)?.nilai
          if (!key) continue
          const n = typeof nilai === 'number' ? nilai : typeof nilai === 'string' && nilai.trim().length > 0 ? Number(nilai) : NaN
          if (!Number.isFinite(n)) continue
          map[key] = String(n)
        }
        nextDraft[kelompokId] = map
      }

      if (Object.keys(nextDraft).length > 0) {
        setNilaiIndividuDraftByKelompokId((prev) => ({ ...prev, ...nextDraft }))
      }
    } catch (e: any) {
      if (e?.status === 404) return
      console.warn('Gagal memuat nilai individu (best-effort):', e)
    }
  }

  async function loadSintaksMapBestEffort(pblId: string) {
    try {
      const res = await pblAPI.getSintaks(pblId)
      if (!res?.success) return

      const arr = extractArrayFromPayload(res.data)
      const next: Record<string, number> = {}
      for (const raw of arr || []) {
        if (!raw || typeof raw !== 'object') continue
        const id = raw.id != null ? String(raw.id).trim() : ''
        const urutanRaw = (raw as any).urutan
        const urutan =
          typeof urutanRaw === 'number'
            ? urutanRaw
            : typeof urutanRaw === 'string' && urutanRaw.trim().length > 0 && !Number.isNaN(Number(urutanRaw))
              ? Number(urutanRaw)
              : null
        if (!id || urutan == null || !Number.isFinite(urutan)) continue
        next[id] = urutan
      }

      if (Object.keys(next).length > 0) setSintaksIdToUrutan(next)
    } catch (e: any) {
      if (e?.status === 404) return
      // best-effort
      console.warn('Gagal memuat sintaks map (best-effort):', e)
    }
  }

  function renderKontribusiIndividu(kelompokIdLocal: string, sintaks: { id?: unknown; urutan?: unknown }) {
    const kId = String(kelompokIdLocal ?? '').trim()
    if (!kId) return null

    const all = kontribusiByKelompokId[kId]
    if (!Array.isArray(all)) return null

    const rows = all
      .filter((c) => {
        if (c.sintaks_urutan != null && Number.isFinite(Number(c.sintaks_urutan))) {
          return Number(c.sintaks_urutan) === Number(sintaks.urutan)
        }

        // Backend sering hanya mengirim `sintaks_id` UUID. Kita map UUID→urutan dari endpoint sintaks.
        const mappedUrutan = sintaksIdToUrutan[String((c as any)?.sintaks_id ?? '').trim()]
        if (mappedUrutan != null && Number.isFinite(Number(mappedUrutan))) {
          return Number(mappedUrutan) === Number(sintaks.urutan)
        }

        const sid = String((c as any)?.sintaks_id ?? '').trim()
        if (!sid) return false
        return sid === String(sintaks.id) || sid === String(sintaks.urutan)
      })
      .slice()
      .sort((a, b) => {
        const ak = normalizeSiswaIdKey(a.siswa_id)
        const bk = normalizeSiswaIdKey(b.siswa_id)
        const an = String(ak ? getSiswaNameByIdKey(ak) : a.siswa_id ?? '').toLowerCase()
        const bn = String(bk ? getSiswaNameByIdKey(bk) : b.siswa_id ?? '').toLowerCase()
        return an.localeCompare(bn)
      })

    if (rows.length === 0) {
      return (
        <div className="mt-3 bg-white rounded p-3 border border-slate-200">
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Icon name="users" className="h-3.5 w-3.5" />
            Kontribusi Individu:
          </p>
          <p className="mt-2 text-xs text-slate-500">Belum ada kontribusi individu untuk tahap ini.</p>
        </div>
      )
    }

    return (
      <div className="mt-3 bg-white rounded p-3 border border-slate-200">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Icon name="users" className="h-3.5 w-3.5" />
            Kontribusi Individu:
          </p>
          <p className="text-[11px] text-slate-500">Menampilkan catatan / file bukti per siswa.</p>
        </div>

        <div className="mt-3 space-y-2">
          {rows.map((c) => {
            const key = normalizeSiswaIdKey(c.siswa_id)
            const name = key ? getSiswaNameByIdKey(key) : String(c.siswa_id ?? '')
            const role = key ? jobdeskByKelompokId[kId]?.[key] : undefined
            const catatan = String(c.catatan ?? '').trim()
            const rawFilePath = c.file_path != null ? String(c.file_path).trim() : ''
            const fileUrl = buildStorageUrl(rawFilePath)
            const ok = catatan.length > 0 || Boolean(fileUrl)

            return (
              <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {role && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          {role}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {ok ? 'Lengkap' : 'Belum lengkap'}
                      </span>
                      {c.submitted_at && (
                        <span className="text-[11px] text-slate-500">
                          {new Date(String(c.submitted_at)).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-md border border-slate-200 bg-white p-2">
                    <p className="text-[11px] font-semibold text-slate-600">Catatan</p>
                    {catatan ? (
                      <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap">{catatan}</p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">Belum diisi.</p>
                    )}
                  </div>

                  <div className="rounded-md border border-slate-200 bg-white p-2">
                    <p className="text-[11px] font-semibold text-slate-600">File Bukti</p>
                    {fileUrl ? (
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-700 truncate">{rawFilePath.split('/').pop()}</span>
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                        >
                          Unduh
                        </a>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">Belum diupload.</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>


      </div>
    )
  }

  function normalizeSiswaIdKey(value: unknown): string {
    const normalized = normalizeSiswaIdForForm(value)
    return String(normalized ?? '').trim()
  }

  function getSiswaNumericId(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const s = String(value ?? '').trim()
    if (!s) return null
    const match = s.match(/^siswa-(\d+)$/i)
    if (match?.[1]) return Number(match[1])
    if (/^\d+$/.test(s)) return Number(s)
    return null
  }

  function getKelompokMemberIdKeys(kelompok: any): string[] {
    const raw: unknown[] =
      (Array.isArray(kelompok?.anggota) && kelompok.anggota) ||
      (Array.isArray(kelompok?.anggota_ids) && kelompok.anggota_ids) ||
      (Array.isArray(kelompok?.siswa) && kelompok.siswa.map((s: any) => s?.id)) ||
      []

    const keys = raw
      .map((v) => normalizeSiswaIdKey(v))
      .filter((v) => v.trim().length > 0)

    return Array.from(new Set(keys))
  }

  function mergeSiswaList(prev: Array<{ id: number | string; nama: string; nis?: string; kelas?: string }>, incoming: any[]) {
    const out = [...prev]
    const seen = new Set(out.map((s) => normalizeSiswaIdKey(s.id)))
    for (const raw of incoming) {
      const idKey = normalizeSiswaIdKey(raw?.id)
      if (!idKey || seen.has(idKey)) continue
      seen.add(idKey)
      out.push({
        ...raw,
        id: normalizeSiswaIdForForm(raw?.id),
      })
    }
    return out
  }

  async function resolveKelompokIdAfterCreate(pblId: string, target: { nama_kelompok: string; anggota_keys: string[] }): Promise<string> {
    try {
      const res = await pblAPI.getKelompok(pblId)
      if (!res?.success) return ''
      const rows = extractArrayFromPayload(res.data) as any[]
      const wantName = String(target.nama_kelompok ?? '').trim()
      const wantMembers = new Set((target.anggota_keys || []).map((k) => String(k).trim()).filter(Boolean))

      const isSameMembers = (kelompok: any) => {
        const members = getKelompokMemberIdKeys(kelompok)
        if (members.length !== wantMembers.size) return false
        for (const m of members) if (!wantMembers.has(m)) return false
        return true
      }

      // Prefer exact match: name + same members
      const exact = rows.find((k) => String(k?.nama_kelompok ?? '').trim() === wantName && isSameMembers(k))
      if (exact?.id != null) return String(exact.id).trim()

      // Fallback: same members only
      const byMembers = rows.find((k) => isSameMembers(k))
      if (byMembers?.id != null) return String(byMembers.id).trim()

      return ''
    } catch {
      return ''
    }
  }

  async function hydrateSiswaForKelompok(rows: Kelompok[]) {
    try {
      const existingKeys = new Set(siswaList.map((s) => normalizeSiswaIdKey(s.id)))
      const neededNumericIds = new Set<number>()

      for (const k of rows) {
        if (Array.isArray((k as any)?.siswa)) {
          for (const s of (k as any).siswa) {
            const key = normalizeSiswaIdKey(s?.id)
            if (key) existingKeys.add(key)
          }
        }

        if (Array.isArray((k as any)?.anggota)) {
          for (const id of (k as any).anggota) {
            const key = normalizeSiswaIdKey(id)
            if (!key || existingKeys.has(key)) continue
            const numeric = getSiswaNumericId(id)
            if (numeric != null) neededNumericIds.add(numeric)
          }
        }
      }

      const missingIds = Array.from(neededNumericIds)
      if (missingIds.length === 0) return

      const results = await Promise.allSettled(missingIds.map((id) => siswaAPI.getById(String(id))))
      const fetched: any[] = []
      for (const r of results) {
        if (r.status !== 'fulfilled') continue
        const res: any = r.value
        const data = res?.data?.user ?? res?.data
        if (res?.success && data) fetched.push(data)
      }
      if (fetched.length === 0) return

      setSiswaList((prev) => mergeSiswaList(prev, fetched))
    } catch (e) {
      console.warn('Gagal hydrate siswa untuk kelompok:', e)
    }
  }

  function uniquePreserveOrder<T>(items: T[], keyOf: (item: T) => string): T[] {
    const out: T[] = []
    const seen = new Set<string>()
    for (const item of items) {
      const key = keyOf(item)
      if (!key) continue
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
    return out
  }

  useEffect(() => {
    loadKelasDiampu()
    loadData()
    loadJurusan()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadKelasDiampu() {
    try {
      const meResponse = await authAPI.me()
      if (meResponse.success && meResponse.data) {
        // Handle nested user object atau direct data
        const userData = meResponse.data.user || meResponse.data
        const kelasData = userData.kelas_diampu || []
        
        if (Array.isArray(kelasData) && kelasData.length > 0) {
          // Jika berisi object dengan property nama/id (format baru dari backend)
          if (typeof kelasData[0] === 'object' && kelasData[0].nama) {
            setKelasList(kelasData)
            setFormData((prev) => ({
              ...prev,
              kelas_ids: Array.isArray(prev.kelas_ids) && prev.kelas_ids.length > 0 ? prev.kelas_ids : [kelasData[0].id],
            }))
            return
          }
          
          // Jika berisi ID saja, coba load detail kelas
          try {
            const kelasResponse = await kelasAPI.getAll()
            if (kelasResponse.success) {
              const allKelas = kelasResponse.data?.data || kelasResponse.data || []
              const kelasDiampu = allKelas.filter((k: any) => 
                kelasData.includes(k.id) || kelasData.includes(String(k.id)) || kelasData.includes(Number(k.id))
              )
              if (kelasDiampu.length > 0) {
                setKelasList(kelasDiampu)
                setFormData((prev) => ({
                  ...prev,
                  kelas_ids: Array.isArray(prev.kelas_ids) && prev.kelas_ids.length > 0 ? prev.kelas_ids : [kelasDiampu[0].id],
                }))
                return
              }
            }
          } catch (err) {
            // 403 - use ID as fallback
            const kelasFromIds = kelasData.map((id: any) => ({
              id: id,
              nama: `Kelas ${id}`,
              tingkat: String(id)
            }))
            setKelasList(kelasFromIds)
            setFormData((prev) => ({
              ...prev,
              kelas_ids: Array.isArray(prev.kelas_ids) && prev.kelas_ids.length > 0 ? prev.kelas_ids : [kelasData[0]],
            }))
            return
          }
        }
      }
      
      // Fallback: kelas manual
      const manualKelas = [
        { id: 'X', nama: 'Kelas X', tingkat: 'X' },
        { id: 'XI', nama: 'Kelas XI', tingkat: 'XI' },
        { id: 'XII', nama: 'Kelas XII', tingkat: 'XII' }
      ]
      setKelasList(manualKelas as any)
      setFormData((prev) => ({
        ...prev,
        kelas_ids: Array.isArray(prev.kelas_ids) && prev.kelas_ids.length > 0 ? prev.kelas_ids : ['X'],
      }))
    } catch (error) {
      console.error('Error loading kelas diampu:', error)
      const manualKelas = [
        { id: 'X', nama: 'Kelas X', tingkat: 'X' },
        { id: 'XI', nama: 'Kelas XI', tingkat: 'XI' },
        { id: 'XII', nama: 'Kelas XII', tingkat: 'XII' }
      ]
      setKelasList(manualKelas as any)
      setFormData((prev) => ({
        ...prev,
        kelas_ids: Array.isArray(prev.kelas_ids) && prev.kelas_ids.length > 0 ? prev.kelas_ids : ['X'],
      }))
    }
  }

  async function loadJurusan() {
    try {
      const response = await jurusanAPI.getAll()
      console.log('Jurusan response:', response)
      
      if (response.success && Array.isArray(response.data) && response.data.length > 0) {
        console.log('Jurusan list:', response.data)
        setJurusanList(response.data)
        // Set default jurusan jika formData.jurusan_id masih kosong
        if (!formData.jurusan_id) {
          setFormData(prev => ({ ...prev, jurusan_id: response.data![0].id }))
        }
      }
    } catch (err) {
      console.error('Error loading jurusan:', err)
    }
  }

  async function loadData() {
    try {
      const response = await pblAPI.getAll()
      if (!response.success) return
      const list: any = (response as any).data?.data ?? (response as any).data
      if (Array.isArray(list)) setProjects(list)
    } catch (error) {
      console.error('Error loading PBL projects:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!Array.isArray(formData.kelas_ids) || formData.kelas_ids.length === 0) {
      alert('Pilih minimal 1 kelas.')
      return
    }

    // Backward-compat: beberapa backend masih memvalidasi field legacy `kelas` (tingkat).
    const selectedKelas = kelasList.filter((k) =>
      Array.isArray(formData.kelas_ids) && formData.kelas_ids.some((id) => String(id) === String(k.id))
    )
    const derivedTingkat =
      selectedKelas.length > 0 && typeof (selectedKelas[0] as any).tingkat === 'string'
        ? String((selectedKelas[0] as any).tingkat).trim()
        : undefined
    
    try {
      const submitData = {
        ...formData,
        ...(derivedTingkat ? { kelas: derivedTingkat } : {}),
        masalah: formData.masalah || '-',
        tujuan_pembelajaran: formData.tujuan_pembelajaran || '-',
        panduan: formData.panduan || '-',
        referensi: formData.referensi || ''
      }

      if (editingProject) {
        await pblAPI.update(editingProject.id, submitData)
        alert('Project PBL berhasil diubah!')
      } else {
        await pblAPI.create(submitData)
        alert('Project PBL berhasil dibuat!')
      }

      resetForm()
      await loadData()
    } catch (error) {
      console.error('Error saving project:', error)
      alert(formatApiErrorAlert('Gagal menyimpan project PBL.', error))
    }
  }

  function resetForm() {
    const defaultJurusan = jurusanList.length > 0 ? jurusanList[0].id : ''
    const defaultKelas: Array<string | number> = kelasList.length > 0 ? [kelasList[0].id] : ['X']
    setFormData({
      judul: '',
      masalah: '',
      tujuan_pembelajaran: '',
      panduan: '',
      referensi: '',
      kelas_ids: defaultKelas,
      jurusan_id: defaultJurusan,
      status: 'Draft',
      deadline: ''
    })
    setShowForm(false)
    setEditingProject(null)
  }

  function handleEdit(project: ProjectPBL) {
    const idsFromList = Array.isArray(project.kelas_list)
      ? project.kelas_list.map((k) => k?.id).filter((v): v is string | number => v != null)
      : []
    const ids = Array.isArray(project.kelas_ids) && project.kelas_ids.length > 0
      ? project.kelas_ids
      : idsFromList.length > 0
        ? idsFromList
        : project.kelas
          ? [project.kelas]
          : []

    setEditingProject(project)
    setFormData({
      judul: project.judul,
      masalah: project.masalah,
      tujuan_pembelajaran: project.tujuan_pembelajaran,
      panduan: project.panduan,
      referensi: project.referensi || '',
      kelas_ids: ids,
      jurusan_id: project.jurusan_id,
      status: project.status,
      deadline: project.deadline
    })
    setShowForm(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Yakin ingin menghapus project PBL ini?')) return
    
    try {
      await pblAPI.delete(id)
      alert('Project PBL berhasil dihapus!')
      await loadData()
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Gagal menghapus project PBL. Silakan coba lagi.')
    }
  }

  async function viewKelompok(project: ProjectPBL) {
    setSelectedProject(project)
    setViewMode('kelompok')

    // Best-effort: muat sintaks untuk mapping UUID → urutan (agar kontribusi individu bisa dipetakan per tahap).
    void loadSintaksMapBestEffort(project.id)
    
    // Load siswa untuk form
    try {
      const kelasForSiswa =
        (Array.isArray(project.kelas_ids) && project.kelas_ids.length > 0 ? project.kelas_ids[0] : null) ??
        (Array.isArray(project.kelas_list) && project.kelas_list.length > 0 ? project.kelas_list[0]?.id : null) ??
        project.kelas ??
        null

      const kelasRaw = kelasForSiswa != null ? String(kelasForSiswa).trim() : ''
      const isNumericKelasId = /^\d+$/.test(kelasRaw)
      const siswaResponse = await siswaAPI.getAll({
        ...(isNumericKelasId ? { kelas_id: kelasRaw } : kelasRaw ? { kelas: kelasRaw } : {}),
        ...(project.jurusan_id ? { jurusan_id: String(project.jurusan_id) } : {}),
      })
      if (siswaResponse.success) {
        const rows = extractArrayFromPayload(siswaResponse.data)
        if (Array.isArray(rows)) {
          setSiswaList(
            rows.map((s: any) => ({
              ...s,
              id: normalizeSiswaIdForForm(s?.id),
            }))
          )
        }
      }
    } catch (error) {
      console.error('Error loading siswa:', error)
    }
    
    // Load kelompok
    try {
      const response = await pblAPI.getKelompok(project.id)
      console.log('Kelompok response:', response)
      console.log('Kelompok data:', response.data)
      if (response.success) {
        const rows = extractArrayFromPayload(response.data)
        console.log('Setting kelompok list:', rows)
        setKelompokList(rows as any)

        // Pastikan nama anggota bisa ter-mapping walau siswaList awal terfilter.
        void hydrateSiswaForKelompok(rows as any)

        // Best-effort: jobdesk per anggota (jika backend sudah mendukung).
        void loadJobdeskBestEffort(project.id, rows as any)
      }
    } catch (error) {
      console.error('Error loading kelompok:', error)
      setKelompokList([])
    }
  }

  async function viewSubmission(project: ProjectPBL) {
    setSelectedProject(project)
    setViewMode('submission')
    setLoadingSubmissions(true)
    setSelectedResultKelompokId('')

    // Best-effort: muat sintaks untuk mapping UUID → urutan.
    void loadSintaksMapBestEffort(project.id)
    
    try {
      // Load siswa untuk mapping nama
      const kelasForSiswa =
        (Array.isArray(project.kelas_ids) && project.kelas_ids.length > 0 ? project.kelas_ids[0] : null) ??
        (Array.isArray(project.kelas_list) && project.kelas_list.length > 0 ? project.kelas_list[0]?.id : null) ??
        project.kelas ??
        null

      const kelasRaw = kelasForSiswa != null ? String(kelasForSiswa).trim() : ''
      const isNumericKelasId = /^\d+$/.test(kelasRaw)
      const siswaResponse = await siswaAPI.getAll({
        ...(isNumericKelasId ? { kelas_id: kelasRaw } : kelasRaw ? { kelas: kelasRaw } : {}),
        ...(project.jurusan_id ? { jurusan_id: String(project.jurusan_id) } : {}),
      })
      if (siswaResponse.success) {
        const rows = extractArrayFromPayload(siswaResponse.data)
        if (Array.isArray(rows)) {
          setSiswaList(
            rows.map((s: any) => ({
              ...s,
              id: normalizeSiswaIdForForm(s?.id),
            }))
          )
        }
      }
      
      // Load kelompok (untuk fallback hasil progress walau belum ada submission)
      let kelompokRows: Kelompok[] = []
      try {
        const kelompokRes = await pblAPI.getKelompok(project.id)
        if (kelompokRes.success) {
          const rows = extractArrayFromPayload(kelompokRes.data)
          kelompokRows = rows as any
          setKelompokList(kelompokRows)

          // Hydrate siswa untuk mapping nama (fallback kalau list siswa terfilter).
          void hydrateSiswaForKelompok(kelompokRows as any)

          // Best-effort: jobdesk per anggota (jika backend sudah mendukung).
          void loadJobdeskBestEffort(project.id, kelompokRows as any)
        }
      } catch (error) {
        console.error('Error loading kelompok:', error)
        setKelompokList([])
      }

      // Load submissions (optional; fallback to progress-only if endpoint not available)
      let subs: Submission[] = []
      try {
        const response = await pblAPI.getSubmissions(project.id)
        const rows = response.success ? extractArrayFromPayload(response.data) : []
        subs = rows as Submission[]
      } catch (e) {
        console.warn('Gagal memuat submissions, lanjut fallback progress:', e)
        subs = []
      }
      if (subs.length > 0) {
        console.log('Submissions data:', subs)

        // Check for duplicate submissions per kelompok
        const kelompokCounts: Record<string, number> = subs.reduce((acc: Record<string, number>, sub: Submission) => {
          const kelompokId = sub.kelompok_id
          acc[kelompokId] = (acc[kelompokId] || 0) + 1
          return acc
        }, {})

        const hasDuplicates = Object.values(kelompokCounts).some((count) => count > 1)
        if (hasDuplicates) {
          console.warn('Ada kelompok yang submit lebih dari 1 kali:', kelompokCounts)
        }

        // Filter: Ambil submission terbaru per kelompok (jika ada duplikat)
        const uniqueSubmissions = subs.reduce((acc: Submission[], sub: Submission) => {
          const existingIndex = acc.findIndex((s) => s.kelompok_id === sub.kelompok_id)
          if (existingIndex === -1) {
            acc.push(sub)
          } else {
            // Bandingkan tanggal, ambil yang lebih baru
            const existingDate = new Date(acc[existingIndex].submitted_at)
            const newDate = new Date(sub.submitted_at)
            if (newDate > existingDate) {
              acc[existingIndex] = sub
            }
          }
          return acc
        }, [])

        console.log('Unique submissions (latest per kelompok):', uniqueSubmissions)
        setSubmissionList(uniqueSubmissions)
        // Initialize nilai form data
        const formData: Record<string, { nilai: string; feedback: string }> = {}
        subs.forEach((sub: Submission) => {
          formData[sub.id] = {
            nilai: sub.nilai != null ? String(sub.nilai) : '',
            feedback: sub.feedback || '',
          }
        })
        setNilaiFormData(formData)
      } else {
        setSubmissionList([])
      }

      // Load progress untuk setiap kelompok
      const progressTargets: string[] = Array.from(
        new Set([
          ...subs.map((s) => String(s.kelompok_id)).filter(Boolean),
          ...(kelompokRows || []).map((k: any) => String(k?.id)).filter(Boolean),
        ])
      )

      const progressData: Record<string, any> = {}
      for (const kelompokId of progressTargets) {
        try {
          const progressRes = await pblAPI.getProgress(project.id, kelompokId)
          if (progressRes.success && progressRes.data) {
            progressData[kelompokId] = progressRes.data
          }
        } catch (e) {
          console.error('Error loading progress for kelompok:', kelompokId, e)
        }
      }
      setSubmissionProgress(progressData)

      const firstKelompokId =
        (subs.length > 0 ? String(subs[0]?.kelompok_id ?? '') : '') ||
        (progressTargets.length > 0 ? String(progressTargets[0] ?? '') : '') ||
        (kelompokRows.length > 0 ? String((kelompokRows[0] as any)?.id ?? '') : '')
      setSelectedResultKelompokId(firstKelompokId)

      // Best-effort: kontribusi individu per kelompok (jika backend sudah mendukung).
      void loadKontribusiBestEffort(project.id, progressTargets)

      // Best-effort: nilai individu per kelompok (jika backend sudah mendukung).
      void loadNilaiIndividuBestEffort(project.id, progressTargets)

      // Auto-expand semua fase standar saat pertama kali buka
      setExpandedSintaks(DISPLAY_SINTAKS.map((s) => s.id))

      // Kelompok sudah diload di awal untuk fallback.
      
    } catch (error) {
      console.error('Error loading submissions:', error)
      setSubmissionList([])
    } finally {
      setLoadingSubmissions(false)
    }
  }

  async function handleNilaiSubmission(submissionId: string) {
    const data = nilaiFormData[submissionId]
    if (!data || !data.nilai || data.nilai.trim() === '') {
      alert('Masukkan nilai terlebih dahulu.')
      return
    }

    const nilaiNum = parseFloat(data.nilai)
    if (isNaN(nilaiNum) || nilaiNum < 0 || nilaiNum > 100) {
      alert('Nilai harus antara 0-100.')
      return
    }

    try {
      setSavingNilai(submissionId)
      const response = await pblAPI.nilaiSubmission(submissionId, {
        nilai: nilaiNum,
        feedback: data.feedback || ''
      })
      
      if (response.success) {
        alert('Nilai berhasil disimpan!')
        // Reload submissions
        if (selectedProject) {
          await viewSubmission(selectedProject)
        }
      }
    } catch (error) {
      console.error('Error saving nilai:', error)
      alert(formatApiErrorAlert('Gagal menyimpan nilai.', error))
    } finally {
      setSavingNilai(null)
    }
  }

  function coerceNilaiNumber(input: unknown): number | null {
    if (typeof input === 'number' && Number.isFinite(input)) return input
    const s = String(input ?? '').trim()
    if (!s) return null
    const n = Number(s)
    if (!Number.isFinite(n)) return null
    return n
  }

  function getKontribusiStatsForKelompok(kelompokIdLocal: string) {
    const kId = String(kelompokIdLocal ?? '').trim()
    const list = Array.isArray(kontribusiByKelompokId[kId]) ? kontribusiByKelompokId[kId] : []
    const bySiswa: Record<string, { total: number; lengkap: number }> = {}
    for (const c of list) {
      const key = normalizeSiswaIdKey((c as any)?.siswa_id)
      if (!key) continue
      if (!bySiswa[key]) bySiswa[key] = { total: 0, lengkap: 0 }
      bySiswa[key].total += 1
      const catatan = String((c as any)?.catatan ?? '').trim()
      const filePath = (c as any)?.file_path != null ? String((c as any).file_path).trim() : ''
      if (catatan.length > 0 || filePath.length > 0) bySiswa[key].lengkap += 1
    }
    return bySiswa
  }

  async function handleSaveNilaiIndividu(pblId: string, kelompokId: string, anggotaKeys: string[], defaultNilai?: number | null) {
    if (!pblId || !kelompokId) return
    if (savingNilaiIndividu) return

    const draft = nilaiIndividuDraftByKelompokId[kelompokId] || {}

    let items: Array<{ siswa_id: string; nilai: number }> = []
    for (const key of anggotaKeys) {
      const raw = draft[key]
      const value = raw != null ? String(raw).trim() : ''
      if (!value) continue
      const n = coerceNilaiNumber(value)
      if (n == null) {
        alert('Nilai individu tidak valid.')
        return
      }
      if (n < 0 || n > 100) {
        alert('Nilai individu harus di antara 0-100.')
        return
      }
      items.push({ siswa_id: key, nilai: n })
    }

    if (items.length === 0) {
      const dn = typeof defaultNilai === 'number' ? defaultNilai : null
      if (dn != null && Number.isFinite(dn) && dn >= 0 && dn <= 100) {
        items = anggotaKeys.map((key) => ({ siswa_id: key, nilai: dn }))
      } else {
        alert('Tidak ada nilai individu yang bisa disimpan.')
        return
      }
    }

    try {
      setSavingNilaiIndividu(kelompokId)
      const res = await pblAPI.setNilaiIndividuKelompok(pblId, kelompokId, { items })
      if ((res as any)?.success) {
        alert('Nilai individu berhasil disimpan.')
        void loadNilaiIndividuBestEffort(pblId, [kelompokId])
        return
      }
      alert('Gagal menyimpan nilai individu.')
    } catch (e: any) {
      if (e?.status === 404 || e?.status === 405) {
        alert(
          'Backend belum mendukung edit nilai PBL per siswa.\n\nTambahkan endpoint: PUT /pbl/{pblId}/kelompok/{kelompokId}/nilai-individu'
        )
        return
      }
      alert(formatApiErrorAlert('Gagal menyimpan nilai individu', e))
    } finally {
      setSavingNilaiIndividu(null)
    }
  }

  async function handleKelompokSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProject) return

    try {
      const selectedSiswa = siswaList.filter((s) => kelompokFormData.anggota_ids.includes(s.id))
      const anggotaNamaList = selectedSiswa.map((s) => s.nama).join('\n')

      const rawSelectedIds = Array.isArray(kelompokFormData.anggota_ids) ? kelompokFormData.anggota_ids : []
      if (rawSelectedIds.length === 0) {
        alert('Gagal menyimpan kelompok. Pilih minimal 1 anggota. Silakan coba lagi.')
        return
      }
      const rawKetua = kelompokFormData.ketua_id
      const ketuaId = rawKetua != null && String(rawKetua).trim().length > 0 ? rawKetua : rawSelectedIds[0]
      const ketuaIsMember = rawSelectedIds.some((id) => String(id) === String(ketuaId))
      if (!ketuaId || !ketuaIsMember) {
        alert('Gagal menyimpan kelompok. Ketua harus termasuk anggota kelompok. Silakan coba lagi.')
        return
      }
      const orderedIds = (() => {
        if (!ketuaId) return rawSelectedIds
        const rest = rawSelectedIds.filter((id) => id !== ketuaId)
        return [ketuaId, ...rest]
      })()

      const uniqueOrderedIds = uniquePreserveOrder(orderedIds, (id) => String(id).trim())
      if (uniqueOrderedIds.length === 0) {
        alert('Gagal menyimpan kelompok. Anggota kelompok tidak valid. Silakan coba lagi.')
        return
      }

      // Validasi: 1 siswa hanya boleh ada di 1 kelompok per project.
      // (Edit diperbolehkan menyimpan anggota yang memang sudah ada di kelompok ini.)
      const currentKelompokId = editingKelompok?.id != null ? String(editingKelompok.id) : null
      const usedByKelompok = new Map<string, string>()
      for (const k of kelompokList as any[]) {
        const kId = k?.id != null ? String(k.id) : ''
        if (!kId) continue
        if (currentKelompokId && kId === currentKelompokId) continue
        const kName = String(k?.nama_kelompok ?? k?.namaKelompok ?? 'Kelompok').trim() || 'Kelompok'
        for (const key of getKelompokMemberIdKeys(k)) {
          if (!usedByKelompok.has(key)) usedByKelompok.set(key, kName)
        }
      }

      const conflicts = uniqueOrderedIds
        .map((id) => {
          const key = normalizeSiswaIdKey(id)
          if (!key) return null
          const groupName = usedByKelompok.get(key)
          if (!groupName) return null
          const siswa = siswaList.find((s) => normalizeSiswaIdKey(s.id) === key)
          const displayName = String(siswa?.nama ?? key)
          return `${displayName} (sudah di ${groupName})`
        })
        .filter((v): v is string => Boolean(v))

      if (conflicts.length > 0) {
        alert(
          'Tidak bisa menyimpan kelompok. Ada siswa yang sudah terdaftar di kelompok lain:\n' +
            conflicts.join('\n') +
            '\n\nSatu siswa hanya boleh berada di 1 kelompok dalam 1 project.'
        )
        return
      }

      // Backend contract (API docs): `anggota: ["siswa-1", ...]`
      const anggota = uniqueOrderedIds
        .map((id) => {
          if (typeof id === 'number') return `siswa-${id}`
          const s = String(id)
          if (/^\d+$/.test(s)) return `siswa-${s}`
          return s
        })
        .filter((v) => String(v).trim().length > 0)

      if (anggota.length === 0) {
        alert('Gagal menyimpan kelompok. Anggota kelompok tidak valid. Silakan coba lagi.')
        return
      }

      // Siapkan payload jobdesk (best-effort). Yang tidak dipilih role-nya akan dilewati.
      const jobdeskPayload: JobdeskItem[] = uniqueOrderedIds
        .map((id) => {
          const key = normalizeSiswaIdKey(id)
          const role = jobdeskDraft[key]
          if (!key || !role) return null
          return { siswa_id: key, role }
        })
        .filter(Boolean) as JobdeskItem[]

      const dataToSend = {
        nama_kelompok: kelompokFormData.nama_kelompok,
        studi_kasus: kelompokFormData.studi_kasus,
        anggota,
        // Legacy fallback still accepted by some backends
        anggota_kelompok: anggotaNamaList,
        // Transitional
        anggota_ids: uniqueOrderedIds,
      }
      
      console.log('Sending kelompok data:', dataToSend)
      console.log('Selected siswa:', selectedSiswa)
      
      if (editingKelompok) {
        const response = await pblAPI.updateKelompok(selectedProject.id, editingKelompok.id, dataToSend)
        console.log('Update kelompok response:', response)

        // Best-effort: simpan jobdesk (jika backend sudah mendukung).
        if (jobdeskPayload.length > 0) {
          try {
            await pblAPI.setJobdesk(selectedProject.id, String(editingKelompok.id), { jobdesk: jobdeskPayload })
            setJobdeskByKelompokId((prev) => ({ ...prev, [String(editingKelompok.id)]: buildJobdeskMap(jobdeskPayload as any, normalizeSiswaIdKey) }))
          } catch (e: any) {
            if (e?.status !== 404) console.warn('Gagal menyimpan jobdesk (best-effort):', e)
          }
        }

        alert('Kelompok berhasil diubah!')
      } else {
        const response = await pblAPI.createKelompok(selectedProject.id, dataToSend)
        console.log('Create kelompok response:', response)

        // Best-effort: simpan jobdesk setelah kelompok berhasil dibuat.
        if (jobdeskPayload.length > 0) {
          try {
            let kelompokId = extractCreatedKelompokId(response)
            if (!kelompokId) {
              const anggotaKeys = uniqueOrderedIds.map((id) => normalizeSiswaIdKey(id)).filter((v) => v.trim().length > 0)
              kelompokId = await resolveKelompokIdAfterCreate(selectedProject.id, {
                nama_kelompok: kelompokFormData.nama_kelompok,
                anggota_keys: anggotaKeys,
              })
            }

            if (kelompokId) {
              await pblAPI.setJobdesk(selectedProject.id, String(kelompokId), { jobdesk: jobdeskPayload })
              setJobdeskByKelompokId((prev) => ({ ...prev, [String(kelompokId)]: buildJobdeskMap(jobdeskPayload as any, normalizeSiswaIdKey) }))
            }
          } catch (e: any) {
            if (e?.status !== 404) console.warn('Gagal menyimpan jobdesk saat create (best-effort):', e)
          }
        }

        alert('Kelompok berhasil ditambahkan!')
      }
      resetKelompokForm()
      await viewKelompok(selectedProject)
    } catch (error: any) {
      console.error('Error saving kelompok:', error)
      console.error('Error detail:', error.message)
      alert(formatApiErrorAlert('Gagal menyimpan kelompok.', error))
    }
  }

  function resetKelompokForm() {
    setKelompokFormData({
      nama_kelompok: '',
      studi_kasus: '',
      anggota_ids: [],
      ketua_id: ''
    })
    setShowKelompokForm(false)
    setEditingKelompok(null)
    setJobdeskDraft({})
  }

  function handleEditKelompok(kelompok: Kelompok) {
    setEditingKelompok(kelompok)
    
    // Parse anggota jadi array of IDs (supports multiple backend formats)
    let anggotaIds: Array<string | number> = []
    if (Array.isArray((kelompok as any).anggota)) {
      anggotaIds = (kelompok as any).anggota as Array<string | number>
    } else if (Array.isArray(kelompok.anggota_kelompok)) {
      anggotaIds = kelompok.anggota_kelompok as any
    } else if (kelompok.siswa && Array.isArray(kelompok.siswa)) {
      anggotaIds = kelompok.siswa.map((s) => s.id)
    }

    const normalizedAnggotaIds = uniquePreserveOrder(
      (anggotaIds
        .map(normalizeSiswaIdForForm)
        .filter((v) => String(v).trim().length > 0) as Array<string | number>),
      (id) => String(id).trim()
    )

    const ketuaId = normalizedAnggotaIds.length > 0 ? normalizedAnggotaIds[0] : ''
    
    setKelompokFormData({
      nama_kelompok: kelompok.nama_kelompok,
      studi_kasus: typeof (kelompok as any).studi_kasus === 'string' ? (kelompok as any).studi_kasus : '',
      anggota_ids: normalizedAnggotaIds,
      ketua_id: ketuaId
    })

    // Init jobdesk draft dari cache jika ada, fallback: ketua -> Ketua
    const kelompokId = String((kelompok as any)?.id ?? '').trim()
    const cached = kelompokId ? jobdeskByKelompokId[kelompokId] : null
    const nextDraft: Record<string, JobdeskRole> = {}
    for (const member of normalizedAnggotaIds) {
      const key = normalizeSiswaIdKey(member)
      if (!key) continue
      const role = cached?.[key] ?? null
      if (role) nextDraft[key] = role
    }
    const ketuaKey = normalizeSiswaIdKey(ketuaId)
    if (ketuaKey && !nextDraft[ketuaKey]) nextDraft[ketuaKey] = 'Ketua'
    setJobdeskDraft(nextDraft)

    // Best-effort: refresh jobdesk dari backend jika ada
    if (selectedProject?.id && kelompokId) {
      void (async () => {
        try {
          const res = await pblAPI.getJobdesk(selectedProject.id, kelompokId)
          if (!res?.success) return
          const arr = Array.isArray((res as any)?.data?.jobdesk)
            ? (res as any).data.jobdesk
            : Array.isArray((res as any)?.data?.data?.jobdesk)
              ? (res as any).data.data.jobdesk
              : []
          if (!Array.isArray(arr) || arr.length === 0) return
          const map = buildJobdeskMap(arr, normalizeSiswaIdKey)
          setJobdeskByKelompokId((prev) => ({ ...prev, [kelompokId]: map }))
          setJobdeskDraft((prev) => ({ ...prev, ...map }))
        } catch (e: any) {
          if (e?.status !== 404) console.warn('Gagal memuat jobdesk saat edit (best-effort):', e)
        }
      })()
    }

    setShowKelompokForm(true)
  }

  async function handleDeleteKelompok(kelompokId: string) {
    if (!selectedProject) return
    if (!confirm('Yakin ingin menghapus kelompok ini?')) return

    try {
      await pblAPI.deleteKelompok(selectedProject.id, kelompokId)
      alert('Kelompok berhasil dihapus!')
      await viewKelompok(selectedProject)
    } catch (error) {
      console.error('Error deleting kelompok:', error)
      alert('Gagal menghapus kelompok. Silakan coba lagi.')
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-slate-600">Memuat...</div>
      </div>
    )
  }

  // Detail Kelompok View
  if (selectedProject && viewMode === 'kelompok') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 p-6">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => {
              setSelectedProject(null)
              setKelompokList([])
              resetKelompokForm()
              setViewMode(null)
            }}
            className="mb-6 flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
          >
            ← Kembali ke Daftar Project
          </button>

          <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
            <h1 className="text-3xl font-black text-slate-800">{selectedProject.judul}</h1>
            <p className="mt-2 text-sm text-slate-600">Kelola kelompok siswa untuk project ini</p>
          </div>

          <div className="mb-6 flex justify-end">
            <button
              onClick={() => {
                setKelompokFormData({ nama_kelompok: '', studi_kasus: '', anggota_ids: [], ketua_id: '' })
                setShowKelompokForm(!showKelompokForm)
              }}
              className="rounded-xl bg-amber-500 px-5 py-2.5 font-bold text-white shadow-md hover:bg-amber-600"
            >
              {showKelompokForm ? (
                <span className="inline-flex items-center gap-2">
                  <Icon name="x" />
                  Tutup Form
                </span>
              ) : (
                '+ Tambah Kelompok'
              )}
            </button>
          </div>

          {showKelompokForm && (
            <div className="mb-8 rounded-2xl border-2 border-amber-300 bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-bold text-slate-800">
                {editingKelompok ? 'Edit Kelompok' : 'Tambah Kelompok Baru'}
              </h2>
              <form onSubmit={handleKelompokSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Nama Kelompok *</label>
                  <input
                    type="text"
                    value={kelompokFormData.nama_kelompok}
                    onChange={(e) => setKelompokFormData({ ...kelompokFormData, nama_kelompok: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500"
                    placeholder="Kelompok 1"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Studi Kasus (untuk Sintaks 1)</label>
                  <textarea
                    value={kelompokFormData.studi_kasus}
                    onChange={(e) => setKelompokFormData({ ...kelompokFormData, studi_kasus: e.target.value })}
                    rows={5}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500 resize-y"
                    placeholder="Tuliskan studi kasus khusus untuk kelompok ini."
                  />
                  <p className="mt-1 text-xs text-slate-500">Ditampilkan ke siswa pada Sintaks 1 (Orientasi Masalah).</p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Pilih Anggota Kelompok *</label>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 max-h-80 overflow-y-auto">
                    {siswaList.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">
                        Tidak ada siswa di kelas ini
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {siswaList.map((siswa) => (
                          <label key={siswa.id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-lg">
                            <input
                              type="checkbox"
                              checked={kelompokFormData.anggota_ids.includes(siswa.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const nextIds = kelompokFormData.anggota_ids.includes(siswa.id)
                                    ? kelompokFormData.anggota_ids
                                    : [...kelompokFormData.anggota_ids, siswa.id]
                                  setKelompokFormData((prev) => ({
                                    ...prev,
                                    anggota_ids: nextIds,
                                    ketua_id:
                                      prev.ketua_id && String(prev.ketua_id).trim().length > 0
                                        ? prev.ketua_id
                                        : nextIds[0] ?? '',
                                  }))
                                } else {
                                  const nextIds = kelompokFormData.anggota_ids.filter((id) => id !== siswa.id)
                                  const removedWasKetua = String(kelompokFormData.ketua_id) === String(siswa.id)
                                  setKelompokFormData((prev) => ({
                                    ...prev,
                                    anggota_ids: nextIds,
                                    ketua_id: removedWasKetua ? (nextIds[0] ?? '') : prev.ketua_id,
                                  }))
                                }
                              }}
                              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                            />
                            <div className="flex-1">
                              <span className="text-sm font-semibold text-slate-700">{siswa.nama}</span>
                              {siswa.nis && <span className="ml-2 text-xs text-slate-500">NIS: {siswa.nis}</span>}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Dipilih: {kelompokFormData.anggota_ids.length} siswa
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Ketua Kelompok *</label>
                  <ResponsiveSelect
                    value={String(kelompokFormData.ketua_id ?? '')}
                    onChange={(value) =>
                      setKelompokFormData((prev) => ({ ...prev, ketua_id: normalizeSiswaIdForForm(value) }))
                    }
                    placeholder={kelompokFormData.anggota_ids.length === 0 ? 'Pilih anggota dulu' : 'Pilih Ketua'}
                    includeEmptyOption={false}
                    disabled={kelompokFormData.anggota_ids.length === 0}
                    buttonClassName="border-slate-300 focus:border-amber-500 disabled:opacity-50"
                    options={
                      siswaList
                        .filter((s) => kelompokFormData.anggota_ids.includes(s.id))
                        .map((s) => ({ value: String(s.id), label: s.nama }))
                    }
                  />
                  <p className="mt-1 text-xs text-slate-500">Hanya ketua yang akan mengisi progress/jawaban PBL.</p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Jobdesk Anggota (validator)</label>
                  <p className="mb-3 text-xs text-slate-500">
                    Guru menetapkan peran untuk tiap anggota. Jika backend belum mendukung endpoint jobdesk, pengaturan ini akan diabaikan tanpa mengganggu fitur yang lain.
                  </p>

                  {kelompokFormData.anggota_ids.length === 0 ? (
                    <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600 border border-slate-200">
                      Pilih anggota dulu untuk mengatur jobdesk.
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                      {kelompokFormData.anggota_ids.map((memberId) => {
                        const key = normalizeSiswaIdKey(memberId)
                        const name = key ? getSiswaNameByIdKey(key) : 'Siswa'
                        const value = key ? jobdeskDraft[key] : undefined

                        return (
                          <div key={String(memberId)} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm font-semibold text-slate-700">{name}</div>
                            <div className="sm:w-72">
                              <ResponsiveSelect
                                value={value ? String(value) : ''}
                                onChange={(next) => {
                                  const role = normalizeJobdeskRole(next)
                                  if (!key) return
                                  setJobdeskDraft((prev) => {
                                    const copy = { ...prev }
                                    if (!role) {
                                      delete copy[key]
                                      return copy
                                    }
                                    copy[key] = role
                                    return copy
                                  })
                                }}
                                placeholder="Pilih jobdesk"
                                includeEmptyOption={true}
                                buttonClassName="border-slate-300 focus:border-amber-500"
                                options={[
                                  { value: 'Ketua', label: 'Ketua' },
                                  { value: 'Penyelidik', label: 'Penyelidik' },
                                  { value: 'Analis', label: 'Analis' },
                                  { value: 'Notulis', label: 'Notulis' },
                                ]}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={kelompokFormData.anggota_ids.length === 0}
                  className="w-full rounded-lg bg-amber-500 py-3 font-bold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingKelompok ? 'Simpan Perubahan' : 'Tambah Kelompok'}
                </button>
              </form>
            </div>
          )}

          {kelompokList.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center">
              <p className="text-slate-600">Belum ada kelompok untuk project ini.</p>
              <p className="mt-2 text-sm text-slate-500">Klik "Tambah Kelompok" untuk mulai membuat kelompok</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {kelompokList.map((kelompok) => {
                console.log('Rendering kelompok:', kelompok)
                console.log('kelompok.anggota:', kelompok.anggota)
                console.log('kelompok.siswa:', kelompok.siswa)
                console.log('kelompok.anggota_kelompok:', kelompok.anggota_kelompok)
                console.log('Available siswaList:', siswaList)
                
                const isExpanded = expandedKelompok.includes(kelompok.id)
                
                // Handle different response formats from backend
                let anggotaList: Array<{ nama: string; nis?: string }> = []
                
                if (kelompok.anggota && Array.isArray(kelompok.anggota)) {
                  // Backend returns array of siswa IDs like ["siswa-10", "siswa-8"]
                  console.log('Using anggota array (IDs)')
                  console.log('siswaList IDs available:', siswaList.map(s => s.id))
                  anggotaList = kelompok.anggota
                    .map(id => {
                      // Backend may send: "siswa-10" | 10 | "10".
                      // Normalize both sides to avoid falling back to placeholder names.
                      const idKey = normalizeSiswaIdKey(id)
                      const numericId = getSiswaNumericId(id)

                      const siswa = siswaList.find((s) => normalizeSiswaIdKey(s.id) === idKey)
                      
                      console.log(`Looking for siswa ID ${id}:`, siswa)
                      
                      if (siswa) {
                        return siswa
                      } else {
                        // If not found in siswaList, create placeholder from ID
                        const labelId = numericId != null ? String(numericId) : (idKey || String(id))
                        return { id: numericId ?? idKey ?? id, nama: `Siswa ${labelId}` }
                      }
                    })
                    .filter((s): s is { id: number | string; nama: string; nis?: string } => s !== null)
                } else if (kelompok.siswa && Array.isArray(kelompok.siswa)) {
                  // Backend populated with siswa objects
                  console.log('Using siswa array')
                  anggotaList = kelompok.siswa
                } else if (typeof kelompok.anggota_kelompok === 'string' && kelompok.anggota_kelompok.trim()) {
                  // Legacy: text format
                  console.log('Using text format, splitting:', kelompok.anggota_kelompok)
                  anggotaList = kelompok.anggota_kelompok.split('\n').filter(n => n.trim()).map(nama => ({ nama: nama.trim() }))
                }
                
                console.log('Final anggotaList:', anggotaList)

                // Deduplicate in UI (in case backend/legacy data contains duplicates)
                anggotaList = uniquePreserveOrder(anggotaList as any, (a: any) => {
                  const id = a?.id != null ? String(a.id) : ''
                  if (id) return `id:${id}`
                  const nama = a?.nama != null ? String(a.nama) : ''
                  const nis = a?.nis != null ? String(a.nis) : ''
                  return `n:${nama}|${nis}`
                }) as any
                
                return (
                  <div
                    key={kelompok.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">{kelompok.nama_kelompok}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {anggotaList.length} anggota
                        </p>
                        {typeof (kelompok as any).studi_kasus === 'string' && (kelompok as any).studi_kasus.trim().length > 0 && (
                          <p className="mt-2 text-xs text-slate-600 line-clamp-2 whitespace-pre-wrap">
                            <span className="font-semibold">Studi kasus:</span> {(kelompok as any).studi_kasus}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedKelompok(expandedKelompok.filter(id => id !== kelompok.id))
                            } else {
                              setExpandedKelompok([...expandedKelompok, kelompok.id])
                            }
                          }}
                          className="rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-200"
                        >
                          {isExpanded ? 'Tutup' : 'Detail'}
                        </button>
                        <button
                          onClick={() => handleEditKelompok(kelompok)}
                          className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteKelompok(kelompok.id)}
                          className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-200"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="rounded-lg bg-slate-50 p-4 border-t border-slate-200">
                        {typeof (kelompok as any).studi_kasus === 'string' && (kelompok as any).studi_kasus.trim().length > 0 ? (
                          <div className="mb-4 rounded-lg bg-amber-50 p-4 border border-amber-200">
                            <p className="mb-2 text-xs font-semibold text-amber-800">Studi Kasus (Sintaks 1):</p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{(kelompok as any).studi_kasus}</p>
                          </div>
                        ) : (
                          <div className="mb-4 rounded-lg bg-slate-100 p-4 border border-slate-200">
                            <p className="text-xs font-semibold text-slate-700">Studi kasus belum diisi.</p>
                            <p className="mt-1 text-xs text-slate-500">Isi lewat tombol Edit agar muncul di Sintaks 1 siswa.</p>
                          </div>
                        )}

                        <p className="mb-3 text-xs font-semibold text-slate-700">Daftar Anggota:</p>
                        {anggotaList.length > 0 ? (
                          <div className="space-y-1">
                            {anggotaList.map((anggota, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                                  {idx + 1}
                                </span>
                                <span>{anggota.nama}</span>
                                {idx === 0 && (
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                    Ketua
                                  </span>
                                )}
                                {anggota.nis && <span className="ml-auto text-xs text-slate-400">NIS: {anggota.nis}</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">Belum ada anggota</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Submission View
  if (selectedProject && viewMode === 'submission') {
    const showProgressFallback = submissionList.length === 0 && Object.keys(submissionProgress || {}).length > 0
    const submittedKelompokIds = new Set((submissionList || []).map((s) => String(s.kelompok_id)))
    const pendingKelompok = (kelompokList || []).filter((k: any) => !submittedKelompokIds.has(String(k?.id)))

    const leaderboardData = computeTeacherLeaderboard({
      phases: DEFAULT_PBL_PHASES.map((p) => ({ urutan: p.urutan, judul: p.judul })),
      kelompokList: kelompokList || [],
      submissionProgress: submissionProgress || {},
    })

    const hasLeaderboardData =
      (leaderboardData.rows || []).length > 0 &&
      ((kelompokList || []).length > 0 || Object.keys(submissionProgress || {}).length > 0)

    const kelompokNameById = new Map<string, string>()
    for (const row of leaderboardData.rows || []) {
      const id = String(row.kelompok_id ?? '').trim()
      if (!id) continue
      if (!kelompokNameById.has(id)) kelompokNameById.set(id, row.kelompok_name || `Kelompok ${id}`)
    }
    for (const k of kelompokList || []) {
      const id = String((k as any)?.id ?? '').trim()
      if (!id) continue
      const name = String((k as any)?.nama_kelompok ?? '').trim() || `Kelompok ${id}`
      if (!kelompokNameById.has(id)) kelompokNameById.set(id, name)
    }
    for (const s of submissionList || []) {
      const id = String((s as any)?.kelompok_id ?? '').trim()
      if (!id) continue
      const name =
        String((s as any)?.kelompok?.nama_kelompok ?? '').trim() ||
        kelompokNameById.get(id) ||
        `Kelompok ${id}`
      if (!kelompokNameById.has(id)) kelompokNameById.set(id, name)
    }
    for (const id of Object.keys(submissionProgress || {})) {
      const key = String(id).trim()
      if (!key) continue
      if (!kelompokNameById.has(key)) kelompokNameById.set(key, `Kelompok ${key}`)
    }

    const hasilKelompokOptions = Array.from(kelompokNameById.entries()).map(([id, nama]) => ({ id, nama }))
    const effectiveSelectedKelompokId =
      selectedResultKelompokId && hasilKelompokOptions.some((k) => k.id === selectedResultKelompokId)
        ? selectedResultKelompokId
        : hasilKelompokOptions[0]?.id ?? ''

    const filteredSubmissionList = (submissionList || []).filter(
      (s) => String((s as any)?.kelompok_id ?? '') === effectiveSelectedKelompokId
    )
    const filteredPendingKelompok = (pendingKelompok || []).filter(
      (k: any) => String(k?.id ?? '') === effectiveSelectedKelompokId
    )
    const filteredFallbackKelompok = (kelompokList || []).filter(
      (k: any) => String(k?.id ?? '') === effectiveSelectedKelompokId
    )

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 p-6">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => {
              setSelectedProject(null)
              setSubmissionList([])
              setExpandedSintaks([])
              setViewMode(null)
            }}
            className="mb-6 flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
          >
            ← Kembali ke Daftar Project
          </button>

          <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
            <h1 className="text-3xl font-black text-slate-800">{selectedProject.judul}</h1>
            <p className="mt-2 text-sm text-slate-600">Hasil submission dari kelompok siswa</p>
          </div>

          {!loadingSubmissions && hasLeaderboardData && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Icon name="chart" className="h-4 w-4" />
                    Leaderboard Kelompok
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Urutan berdasarkan progres + bonus tercepat per tahap (Top 3: +3/+2/+1).
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                  <Icon name="check" className="h-4 w-4" />
                  Bonus tercepat aktif
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Rank</th>
                      <th className="py-2 pr-3">Kelompok</th>
                      <th className="py-2 pr-3">Progres</th>
                      <th className="py-2 pr-3">Bonus</th>
                      <th className="py-2 pr-3">Skor</th>
                      <th className="py-2">Selesai Terakhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaderboardData.rows.map((row, idx) => (
                      <tr key={row.kelompok_id} className="align-top">
                        <td className="py-2 pr-3 font-bold text-slate-700">{idx + 1}</td>
                        <td className="py-2 pr-3">
                          <p className="font-semibold text-slate-800">{row.kelompok_name}</p>
                          <p className="text-xs text-slate-500">ID: {row.kelompok_id}</p>
                        </td>
                        <td className="py-2 pr-3">
                          <p className="font-semibold text-slate-800">{row.completion_percentage}%</p>
                          <p className="text-xs text-slate-500">
                            {row.completed_sintaks}/{row.total_sintaks} tahap
                          </p>
                        </td>
                        <td className="py-2 pr-3">
                          {row.bonus_fastest > 0 ? (
                            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                              +{row.bonus_fastest}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 font-bold text-slate-800">{row.skor}</td>
                        <td className="py-2 text-xs text-slate-600">
                          {row.last_completed_at_ms != null ? formatShortDateTimeId(row.last_completed_at_ms) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Icon name="clock" className="h-4 w-4" />
                  Tercepat per Tahap
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {leaderboardData.fastestByPhase.map((phase) => (
                    <div key={phase.urutan} className="rounded-lg bg-white p-3 border border-slate-200">
                      <p className="text-xs font-bold text-slate-600">Tahap {phase.urutan}</p>
                      <p className="text-sm font-semibold text-slate-800">{phase.judul}</p>
                      {phase.top3.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-400">Belum ada yang menyelesaikan tahap ini.</p>
                      ) : (
                        <div className="mt-2 space-y-1">
                          {phase.top3.map((k, idx) => (
                            <div key={k.kelompok_id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-slate-700">
                                #{idx + 1} {k.kelompok_name}
                              </span>
                              <span className="text-slate-500">{formatShortDateTimeId(k.submitted_at_ms)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loadingSubmissions && hasilKelompokOptions.length > 0 && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
              <p className="text-sm font-semibold text-slate-700">Hasil Kelompok</p>
              <p className="mt-1 text-sm text-slate-500">Pilih kelompok yang ingin dilihat detail hasilnya.</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {hasilKelompokOptions.map((kelompok) => {
                  const isActive = kelompok.id === effectiveSelectedKelompokId
                  const progress = (submissionProgress as any)?.[kelompok.id]
                  const hasFinalSubmission = (submissionList || []).some(
                    (s) => String((s as any)?.kelompok_id ?? '') === kelompok.id
                  )

                  return (
                    <button
                      key={kelompok.id}
                      type="button"
                      onClick={() => setSelectedResultKelompokId(kelompok.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        isActive
                          ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-100'
                          : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/50'
                      }`}
                    >
                      <p className="text-sm font-bold text-slate-800">{kelompok.nama}</p>
                      <p className="mt-1 text-xs text-slate-500">ID: {kelompok.id}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-600">
                          {progress?.completion_percentage != null ? `${progress.completion_percentage}%` : 'Belum ada progress'}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            hasFinalSubmission ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {hasFinalSubmission ? 'Sudah Submit' : 'Progress Saja'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {loadingSubmissions ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
              <p className="text-slate-600">Memuat data submission...</p>
            </div>
          ) : submissionList.length === 0 ? (
            showProgressFallback ? (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-700">Belum ada submission final.</p>
                  <p className="mt-1 text-sm text-slate-500">Menampilkan progress per sintaks dari tiap kelompok (catatan & file) sebagai hasil sementara.</p>
                </div>

                {filteredFallbackKelompok.map((kelompok) => {
                  const kelompokId = String((kelompok as any)?.id ?? '')
                  const kelompokProgress = kelompokId ? (submissionProgress as any)[kelompokId] : null

                  // Get anggota list
                  let anggotaList: Array<{ id: number | string; nama: string; nis?: string }> = []
                  if ((kelompok as any)?.anggota && Array.isArray((kelompok as any).anggota)) {
                    anggotaList = (kelompok as any).anggota
                      .map((id: any) => {
                        const idString = typeof id === 'string' ? id : `siswa-${id}`
                        const numericId =
                          typeof id === 'string' && id.startsWith('siswa-')
                            ? parseInt(id.replace('siswa-', ''))
                            : typeof id === 'number'
                              ? id
                              : null

                        let siswa = siswaList.find((s) => String(s.id) === idString || (s as any).id === id)
                        if (!siswa && numericId) {
                          siswa = siswaList.find((s) => (s as any).id === numericId)
                        }

                        if (siswa) {
                          return siswa
                        } else {
                          return { id: numericId || id, nama: `Siswa ${numericId || id}` }
                        }
                      })
                      .filter((s: any) => s != null)
                  } else if ((kelompok as any)?.siswa && Array.isArray((kelompok as any).siswa)) {
                    anggotaList = (kelompok as any).siswa
                  }

                  return (
                    <div key={kelompokId || (kelompok as any).nama_kelompok} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
                      <div className="mb-4 flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-slate-800">{(kelompok as any)?.nama_kelompok || 'Kelompok'}</h3>
                          <p className="mt-1 text-sm text-slate-500">Hasil progress per sintaks</p>
                        </div>
                        {kelompokProgress?.completion_percentage != null && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                            {kelompokProgress.completion_percentage}%
                          </span>
                        )}
                      </div>

                      {anggotaList.length > 0 && (
                        <div className="mb-4 rounded-lg bg-amber-50 p-4 border border-amber-200">
                          <p className="text-sm font-semibold text-amber-800 mb-2">
                            <span className="inline-flex items-center gap-2">
                              <Icon name="users" className="h-4 w-4" />
                              Anggota Kelompok ({anggotaList.length}):
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {anggotaList.map((anggota, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-amber-200">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                                  {idx + 1}
                                </span>
                                <span className="text-sm text-slate-800">{anggota.nama}</span>
                                {anggota.nis && <span className="text-xs text-slate-400">({anggota.nis})</span>}
                                {(() => {
                                  const kId = String((kelompok as any)?.id ?? '').trim()
                                  const key = normalizeSiswaIdKey((anggota as any)?.id ?? (anggota as any)?.siswa_id)
                                  const role = kId && key ? jobdeskByKelompokId[kId]?.[key] : undefined
                                  if (!role) return null
                                  return (
                                    <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                      {role}
                                    </span>
                                  )
                                })()}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {kelompokProgress && (
                        <div className="mb-4 rounded-lg bg-indigo-50 p-4 border border-indigo-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-800">
                              <Icon name="chart" className="h-4 w-4" />
                              Progress Pengerjaan
                            </span>
                            <span className="text-sm font-bold text-indigo-600">
                              {kelompokProgress.completed_sintaks}/{kelompokProgress.total_sintaks} tahap ({kelompokProgress.completion_percentage}%)
                            </span>
                          </div>
                          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full transition-all duration-500"
                              style={{ width: `${kelompokProgress.completion_percentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {DISPLAY_SINTAKS.length > 0 && (
                        <div className="mb-1 rounded-lg bg-purple-50 p-4 border border-purple-200">
                          <div className="flex items-center justify-between mb-3">
                            <p className="inline-flex items-center gap-2 text-sm font-semibold text-purple-800">
                              <Icon name="clipboard" className="h-4 w-4" />
                              Tahapan Pengerjaan:
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (expandedSintaks.length === DISPLAY_SINTAKS.length) {
                                  setExpandedSintaks([])
                                } else {
                                  setExpandedSintaks(DISPLAY_SINTAKS.map((s) => s.id))
                                }
                              }}
                              className="text-xs text-purple-600 hover:text-purple-800 font-semibold"
                            >
                              {expandedSintaks.length === DISPLAY_SINTAKS.length ? '▲ Tutup Semua' : '▼ Buka Semua'}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {DISPLAY_SINTAKS.map((sintaks, idx) => {
                              const isExpanded = expandedSintaks.includes(sintaks.id)
                              const progressItems = Array.isArray(kelompokProgress?.progress) ? kelompokProgress.progress : []
                              const sintaksProgress =
                                progressItems.find((p: any) => Number(p?.urutan) === Number(sintaks.urutan)) ??
                                progressItems.find((p: any) => String(p?.sintaks_id) === String(sintaks.urutan))
                              const isCompleted = sintaksProgress?.completed || false

                              return (
                                <div key={sintaks.id} className={`bg-white rounded-lg border overflow-hidden ${isCompleted ? 'border-emerald-300' : 'border-purple-100'}`}>
                                  <div
                                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-purple-50"
                                    onClick={() => {
                                      if (isExpanded) {
                                        setExpandedSintaks(expandedSintaks.filter((id) => id !== sintaks.id))
                                      } else {
                                        setExpandedSintaks([...expandedSintaks, sintaks.id])
                                      }
                                    }}
                                  >
                                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${isCompleted ? 'bg-emerald-500' : 'bg-purple-500'}`}>
                                      {isCompleted ? <Icon name="check" className="h-4 w-4" /> : idx + 1}
                                    </span>
                                    <span className="text-sm font-medium text-slate-800 flex-1">{sintaks.nama_fase || `Tahap ${idx + 1}`}</span>
                                    {isCompleted && (
                                      <span className="inline-flex items-center gap-2 rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">
                                        <Icon name="check" className="h-3.5 w-3.5" />
                                        Selesai
                                      </span>
                                    )}
                                    <span className="text-purple-500 text-xs">{isExpanded ? '▼' : '▶'}</span>
                                  </div>

                                  {isExpanded && (
                                    <div className="px-4 py-3 bg-purple-50/50 border-t border-purple-100 space-y-3">
                                      {sintaksProgress ? (
                                        <div className="space-y-2">
                                          {sintaksProgress.catatan && (
                                            <div className="bg-emerald-50 rounded p-3 border border-emerald-200">
                                              <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                                                <Icon name="message" className="h-3.5 w-3.5" />
                                                Catatan Progress:
                                              </p>
                                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{sintaksProgress.catatan}</p>
                                            </div>
                                          )}

                                          {(() => {
                                            const url = buildStorageUrl(sintaksProgress.file_path)
                                            if (!url) return null
                                            const name = String(sintaksProgress.file_path ?? '').split('/').pop()

                                            return (
                                              <div className="bg-blue-50 rounded p-3 border border-blue-200">
                                                <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-blue-700">
                                                  <Icon name="paperclip" className="h-3.5 w-3.5" />
                                                  File Lampiran:
                                                </p>
                                                <div className="flex items-center justify-between">
                                                  <span className="text-sm text-slate-700">{name}</span>
                                                  <a
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                                                  >
                                                    Unduh
                                                  </a>
                                                </div>
                                              </div>
                                            )
                                          })()}

                                          {sintaksProgress.submitted_at && (
                                            <p className="text-xs text-slate-500">
                                              <span className="inline-flex items-center gap-2">
                                                <Icon name="clock" className="h-3.5 w-3.5" />
                                                Dikerjakan: {new Date(sintaksProgress.submitted_at).toLocaleString('id-ID', {
                                                  day: 'numeric',
                                                  month: 'short',
                                                  year: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                                })}
                                              </span>
                                            </p>
                                          )}

                                          {renderKontribusiIndividu(String((kelompok as any)?.id ?? ''), sintaks)}
                                        </div>
                                      ) : (
                                        <div className="bg-slate-50 rounded p-3 border border-slate-200 text-center">
                                          <p className="text-sm text-slate-500">Belum ada progress untuk tahap ini</p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center">
                <p className="text-slate-600">Belum ada submission untuk project ini.</p>
                <p className="mt-2 text-sm text-slate-500">Submission akan muncul setelah kelompok mengumpulkan hasil.</p>
              </div>
            )
          ) : (
            <div className="space-y-6">
              {filteredSubmissionList.map((submission) => {
                const formData = nilaiFormData[submission.id] || { nilai: '', feedback: '' }
                const isSaving = savingNilai === submission.id
                const hasNilai = submission.nilai != null
                
                // Find kelompok detail dari kelompokList
                const kelompokDetail = kelompokList.find(k => k.id === submission.kelompok_id)
                
                // Get anggota list
                let anggotaList: Array<{ id: number | string; nama: string; nis?: string }> = []
                if (kelompokDetail?.anggota && Array.isArray(kelompokDetail.anggota)) {
                  anggotaList = kelompokDetail.anggota
                    .map(id => {
                      const idString = typeof id === 'string' ? id : `siswa-${id}`
                      const numericId = typeof id === 'string' && id.startsWith('siswa-') 
                        ? parseInt(id.replace('siswa-', ''))
                        : typeof id === 'number' ? id : null
                      
                      let siswa = siswaList.find(s => String(s.id) === idString || s.id === id)
                      if (!siswa && numericId) {
                        siswa = siswaList.find(s => s.id === numericId)
                      }
                      
                      if (siswa) {
                        return siswa
                      } else {
                        return { id: numericId || id, nama: `Siswa ${numericId || id}` }
                      }
                    })
                    .filter((s): s is { id: number | string; nama: string; nis?: string } => s !== null)
                } else if (kelompokDetail?.siswa && Array.isArray(kelompokDetail.siswa)) {
                  anggotaList = kelompokDetail.siswa
                } else if (submission.kelompok?.anggota && Array.isArray(submission.kelompok.anggota)) {
                  // Fallback ke data dari submission response
                  anggotaList = submission.kelompok.anggota.map((id: any) => ({
                    id,
                    nama: `Anggota ${id}`
                  }))
                }
                
                return (
                  <div
                    key={submission.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
                  >
                    {/* Header */}
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">
                          {submission.kelompok?.nama_kelompok || 'Kelompok'}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Dikumpulkan: {new Date(submission.submitted_at).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {hasNilai && (
                        <span className="rounded-full bg-emerald-100 px-4 py-2 text-lg font-bold text-emerald-700">
                          {submission.nilai}
                        </span>
                      )}
                    </div>

                    {/* Anggota Kelompok */}
                    {anggotaList.length > 0 && (
                      <div className="mb-4 rounded-lg bg-amber-50 p-4 border border-amber-200">
                        <p className="text-sm font-semibold text-amber-800 mb-2">
                          <span className="inline-flex items-center gap-2">
                            <Icon name="users" className="h-4 w-4" />
                            Anggota Kelompok ({anggotaList.length}):
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {anggotaList.map((anggota, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-amber-200">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                                {idx + 1}
                              </span>
                              <span className="text-sm text-slate-800">{anggota.nama}</span>
                              {anggota.nis && <span className="text-xs text-slate-400">({anggota.nis})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Nilai Individu (opsional) */}
                    {(() => {
                      const pblId = String(selectedProject?.id ?? '')
                      const kelompokId = String(submission.kelompok_id ?? '')
                      if (!pblId || !kelompokId) return null
                      if (!Array.isArray(anggotaList) || anggotaList.length === 0) return null

                      const anggotaKeys = anggotaList
                        .map((a) => normalizeSiswaIdKey(a?.id))
                        .filter((k) => k.trim().length > 0)

                      const groupNilai = typeof submission.nilai === 'number' && Number.isFinite(submission.nilai) ? submission.nilai : null
                      const draft = nilaiIndividuDraftByKelompokId[kelompokId] || {}
                      const stats = getKontribusiStatsForKelompok(kelompokId)

                      return (
                        <div className="mb-4 rounded-lg bg-slate-50 p-4 border border-slate-200">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                                <Icon name="note" className="h-4 w-4" />
                                Nilai Individu
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Atur nilai PBL per anggota (mis. untuk siswa yang kurang aktif).
                              </p>
                              {groupNilai != null && (
                                <p className="mt-1 text-[11px] text-slate-500">Nilai kelompok saat ini: {groupNilai}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveNilaiIndividu(pblId, kelompokId, anggotaKeys, groupNilai)}
                              disabled={savingNilaiIndividu === kelompokId}
                              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {savingNilaiIndividu === kelompokId ? 'Menyimpan…' : 'Simpan Nilai Individu'}
                            </button>
                          </div>

                          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="min-w-full text-left text-sm">
                              <thead className="bg-slate-50 text-xs text-slate-500">
                                <tr>
                                  <th className="px-4 py-3 font-semibold">Siswa</th>
                                  <th className="px-4 py-3 font-semibold">Kontribusi</th>
                                  <th className="px-4 py-3 font-semibold">Nilai Individu</th>
                                </tr>
                              </thead>
                              <tbody>
                                {anggotaList.map((anggota) => {
                                  const key = normalizeSiswaIdKey(anggota?.id)
                                  if (!key) return null
                                  const name = String(anggota?.nama ?? key)
                                  const st = stats[key] || { total: 0, lengkap: 0 }
                                  const value = draft[key] ?? (groupNilai != null ? String(groupNilai) : '')

                                  return (
                                    <tr key={key} className="border-t border-slate-200">
                                      <td className="px-4 py-3 font-semibold text-slate-800">
                                        <div className="min-w-0">
                                          <p className="truncate">{name}</p>
                                          {anggota?.nis && <p className="text-xs text-slate-400">{anggota.nis}</p>}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-slate-700">
                                        <span className="text-xs">Lengkap {st.lengkap}/{st.total}</span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={value}
                                          onChange={(e) => {
                                            const next = e.target.value
                                            setNilaiIndividuDraftByKelompokId((prev) => ({
                                              ...prev,
                                              [kelompokId]: {
                                                ...(prev[kelompokId] || {}),
                                                [key]: next,
                                              },
                                            }))
                                          }}
                                          className="w-full max-w-[160px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                                          placeholder="0-100"
                                        />
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Progress Summary */}
                    {submissionProgress[submission.kelompok_id] && (
                      <div className="mb-4 rounded-lg bg-indigo-50 p-4 border border-indigo-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-800">
                            <Icon name="chart" className="h-4 w-4" />
                            Progress Pengerjaan
                          </span>
                          <span className="text-sm font-bold text-indigo-600">
                            {submissionProgress[submission.kelompok_id].completed_sintaks}/{submissionProgress[submission.kelompok_id].total_sintaks} tahap ({submissionProgress[submission.kelompok_id].completion_percentage}%)
                          </span>
                        </div>
                        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${submissionProgress[submission.kelompok_id].completion_percentage}%` }}
                          />
                        </div>
                        {submissionProgress[submission.kelompok_id].completion_percentage === 100 && (
                          <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-emerald-600">
                            <Icon name="check" />
                            Semua tahapan sudah diselesaikan!
                          </p>
                        )}
                      </div>
                    )}

                    {/* Progress Tahapan */}
                    {DISPLAY_SINTAKS.length > 0 && (
                      <div className="mb-4 rounded-lg bg-purple-50 p-4 border border-purple-200">
                        <div className="flex items-center justify-between mb-3">
                          <p className="inline-flex items-center gap-2 text-sm font-semibold text-purple-800">
                            <Icon name="clipboard" className="h-4 w-4" />
                            Tahapan Pengerjaan:
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (expandedSintaks.length === DISPLAY_SINTAKS.length) {
                                setExpandedSintaks([])
                              } else {
                                setExpandedSintaks(DISPLAY_SINTAKS.map((s) => s.id))
                              }
                            }}
                            className="text-xs text-purple-600 hover:text-purple-800 font-semibold"
                          >
                            {expandedSintaks.length === DISPLAY_SINTAKS.length ? '▲ Tutup Semua' : '▼ Buka Semua'}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {DISPLAY_SINTAKS.map((sintaks, idx) => {
                            const isExpanded = expandedSintaks.includes(sintaks.id)
                            
                            // Cari progress untuk sintaks ini dari kelompok
                            const kelompokProgress = submissionProgress[submission.kelompok_id]
                            const progressItems = Array.isArray(kelompokProgress?.progress) ? kelompokProgress.progress : []
                            const sintaksProgress =
                              progressItems.find((p: any) => Number(p?.urutan) === Number(sintaks.urutan)) ??
                              progressItems.find((p: any) => String(p?.sintaks_id) === String(sintaks.urutan))
                            const isCompleted = sintaksProgress?.completed || false
                            
                            return (
                              <div key={sintaks.id} className={`bg-white rounded-lg border overflow-hidden ${isCompleted ? 'border-emerald-300' : 'border-purple-100'}`}>
                                <div 
                                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-purple-50"
                                  onClick={() => {
                                    if (isExpanded) {
                                      setExpandedSintaks(expandedSintaks.filter(id => id !== sintaks.id))
                                    } else {
                                      setExpandedSintaks([...expandedSintaks, sintaks.id])
                                    }
                                  }}
                                >
                                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${isCompleted ? 'bg-emerald-500' : 'bg-purple-500'}`}>
                                    {isCompleted ? <Icon name="check" className="h-4 w-4" /> : idx + 1}
                                  </span>
                                  <span className="text-sm font-medium text-slate-800 flex-1">
                                    {sintaks.nama_fase || sintaks.judul || `Tahap ${idx + 1}`}
                                  </span>
                                  {isCompleted && (
                                    <span className="inline-flex items-center gap-2 rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">
                                      <Icon name="check" className="h-3.5 w-3.5" />
                                      Selesai
                                    </span>
                                  )}
                                  <span className="text-purple-500 text-xs">
                                    {isExpanded ? '▼' : '▶'}
                                  </span>
                                </div>
                                
                                {isExpanded && (
                                  <div className="px-4 py-3 bg-purple-50/50 border-t border-purple-100 space-y-3">
                                    {/* Deskripsi & Instruksi Tahap */}
                                    {sintaks.deskripsi && (
                                      <div>
                                        <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold text-purple-700">
                                          <Icon name="note" className="h-3.5 w-3.5" />
                                          Deskripsi Tahap:
                                        </p>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{sintaks.deskripsi}</p>
                                      </div>
                                    )}
                                    {sintaks.instruksi && (
                                      <div>
                                        <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold text-purple-700">
                                          <Icon name="pin" className="h-3.5 w-3.5" />
                                          Instruksi:
                                        </p>
                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{sintaks.instruksi}</p>
                                      </div>
                                    )}
                                    
                                    {/* Hasil Pekerjaan Siswa */}
                                    <div className="border-t border-purple-200 pt-3 mt-3">
                                      <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                                        <Icon name="pencil" className="h-3.5 w-3.5" />
                                        Hasil Pekerjaan Kelompok:
                                      </p>
                                      
                                      {sintaksProgress ? (
                                        <div className="space-y-2">
                                          {sintaksProgress.catatan && (
                                            <div className="bg-emerald-50 rounded p-3 border border-emerald-200">
                                              <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                                                <Icon name="message" className="h-3.5 w-3.5" />
                                                Catatan Progress:
                                              </p>
                                              <p className="text-sm text-slate-700 whitespace-pre-wrap">{sintaksProgress.catatan}</p>
                                            </div>
                                          )}
                                          
                                          {(() => {
                                            const url = buildStorageUrl(sintaksProgress.file_path)
                                            if (!url) return null
                                            const name = String(sintaksProgress.file_path ?? '').split('/').pop()

                                            return (
                                              <div className="bg-blue-50 rounded p-3 border border-blue-200">
                                                <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-blue-700">
                                                  <Icon name="paperclip" className="h-3.5 w-3.5" />
                                                  File Lampiran:
                                                </p>
                                                <div className="flex items-center justify-between">
                                                  <span className="text-sm text-slate-700">{name}</span>
                                                  <a
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                                                  >
                                                    Unduh
                                                  </a>
                                                </div>
                                              </div>
                                            )
                                          })()}
                                          
                                          {sintaksProgress.submitted_at && (
                                            <p className="text-xs text-slate-500">
                                              <span className="inline-flex items-center gap-2">
                                                <Icon name="clock" className="h-3.5 w-3.5" />
                                                Dikerjakan: {new Date(sintaksProgress.submitted_at).toLocaleString('id-ID', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                              </span>
                                            </p>
                                          )}

                                          {renderKontribusiIndividu(String(submission.kelompok_id), sintaks)}
                                        </div>
                                      ) : (
                                        <div className="bg-slate-50 rounded p-3 border border-slate-200 text-center">
                                          <p className="text-sm text-slate-500">Belum ada progress untuk tahap ini</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-3 flex items-start gap-2 text-xs text-purple-700 bg-purple-100 rounded p-2">
                          <span className="mt-0.5">
                            <Icon name="help" className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="inline-flex items-center gap-2 font-semibold">
                              Tahapan dengan tanda
                              <Icon name="check" className="h-4 w-4" />
                              hijau sudah dikerjakan kelompok.
                            </p>
                            <p className="mt-1">Klik setiap tahapan untuk melihat catatan progress dan file yang diupload siswa.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* File Info */}
                    <div className="mb-4 rounded-lg bg-slate-50 p-4">
                      <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Icon name="paperclip" className="h-4 w-4" />
                        File Pengumpulan:
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{submission.file_name}</p>
                          <p className="text-xs text-slate-500">
                            Ukuran: {(submission.file_size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        {(() => {
                          // Some backends return file path on submission, others only on sintaks 5 progress.
                          const kelompokProgress = submissionProgress?.[submission.kelompok_id as any]
                          const progressItems = Array.isArray((kelompokProgress as any)?.progress) ? (kelompokProgress as any).progress : []
                          const sintaks5 =
                            progressItems.find((p: any) => Number(p?.urutan) === 5) ??
                            progressItems.find((p: any) => String(p?.sintaks_id) === '5')

                          const url =
                            buildStorageUrl((submission as any)?.file_path) ||
                            buildStorageUrl((submission as any)?.file_url) ||
                            buildStorageUrl((submission as any)?.url) ||
                            buildStorageUrl((submission as any)?.file) ||
                            buildStorageUrl((sintaks5 as any)?.file_path) ||
                            buildStorageUrl((sintaks5 as any)?.file_url) ||
                            buildStorageUrl((sintaks5 as any)?.url) ||
                            buildStorageUrl((sintaks5 as any)?.file)

                          if (!url) {
                            return <span className="text-xs text-slate-400">File tidak tersedia</span>
                          }

                          return (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600"
                            >
                              Unduh
                            </a>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Catatan */}
                    {submission.catatan && (
                      <div className="mb-4 rounded-lg bg-blue-50 p-4 border border-blue-200">
                        <p className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                          <Icon name="message" className="h-4 w-4" />
                          Catatan Kelompok:
                        </p>
                        <p className="text-sm text-blue-900 whitespace-pre-wrap">{submission.catatan}</p>
                      </div>
                    )}

                    {/* Feedback dari Guru */}
                    {hasNilai && submission.feedback && (
                      <div className="mb-4 rounded-lg bg-emerald-50 p-4 border border-emerald-200">
                        <p className="mb-1 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                          <Icon name="check" className="h-4 w-4" />
                          Feedback Guru:
                        </p>
                        <p className="text-sm text-emerald-900 whitespace-pre-wrap">{submission.feedback}</p>
                      </div>
                    )}

                    {/* Form Nilai */}
                    <div className="rounded-lg border-2 border-dashed border-slate-300 p-4">
                      <p className="text-sm font-semibold text-slate-700 mb-3">
                        {hasNilai ? (
                          <span className="inline-flex items-center gap-2">
                            <Icon name="note" className="h-4 w-4" />
                            Edit Nilai:
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <Icon name="note" className="h-4 w-4" />
                            Beri Nilai:
                          </span>
                        )}
                      </p>
                      
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-700">
                            Nilai (0-100) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.nilai}
                            onChange={(e) => setNilaiFormData(prev => ({
                              ...prev,
                              [submission.id]: { ...prev[submission.id], nilai: e.target.value }
                            }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                            placeholder="Masukkan nilai"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-2 block text-sm font-semibold text-slate-700">
                            Feedback (opsional)
                          </label>
                          <textarea
                            value={formData.feedback}
                            onChange={(e) => setNilaiFormData(prev => ({
                              ...prev,
                              [submission.id]: { ...prev[submission.id], feedback: e.target.value }
                            }))}
                            rows={3}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                            placeholder="Berikan feedback untuk kelompok ini..."
                          />
                        </div>

                        <div className="md:col-span-2">
                          <button
                            onClick={() => handleNilaiSubmission(submission.id)}
                            disabled={isSaving || !formData.nilai}
                            className="w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSaving ? (
                              'Menyimpan...'
                            ) : hasNilai ? (
                              <span className="inline-flex items-center justify-center gap-2">
                                <Icon name="save" />
                                Update Nilai
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center gap-2">
                                <Icon name="save" />
                                Simpan Nilai
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {filteredPendingKelompok.length > 0 && Object.keys(submissionProgress || {}).length > 0 && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-700">Kelompok belum mengumpulkan submission final.</p>
                    <p className="mt-1 text-sm text-slate-500">Menampilkan progress per sintaks sebagai hasil sementara.</p>
                  </div>

                  {filteredPendingKelompok.map((kelompok: any) => {
                    const kelompokId = String(kelompok?.id ?? '')
                    const kelompokProgress = kelompokId ? (submissionProgress as any)[kelompokId] : null

                    // Get anggota list
                    let anggotaList: Array<{ id: number | string; nama: string; nis?: string }> = []
                    if (kelompok?.anggota && Array.isArray(kelompok.anggota)) {
                      anggotaList = kelompok.anggota
                        .map((id: any) => {
                          const idString = typeof id === 'string' ? id : `siswa-${id}`
                          const numericId =
                            typeof id === 'string' && id.startsWith('siswa-')
                              ? parseInt(id.replace('siswa-', ''))
                              : typeof id === 'number'
                                ? id
                                : null

                          let siswa = siswaList.find((s) => String(s.id) === idString || (s as any).id === id)
                          if (!siswa && numericId) {
                            siswa = siswaList.find((s) => (s as any).id === numericId)
                          }

                          if (siswa) {
                            return siswa
                          } else {
                            return { id: numericId || id, nama: `Siswa ${numericId || id}` }
                          }
                        })
                        .filter((s: any) => s != null)
                    } else if (kelompok?.siswa && Array.isArray(kelompok.siswa)) {
                      anggotaList = kelompok.siswa
                    }

                    return (
                      <div key={kelompokId || kelompok?.nama_kelompok} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
                        <div className="mb-4 flex items-start justify-between">
                          <div>
                            <h3 className="text-xl font-bold text-slate-800">{kelompok?.nama_kelompok || 'Kelompok'}</h3>
                            <p className="mt-1 text-sm text-slate-500">Hasil progress per sintaks</p>
                          </div>
                          {kelompokProgress?.completion_percentage != null && (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                              {kelompokProgress.completion_percentage}%
                            </span>
                          )}
                        </div>

                        {anggotaList.length > 0 && (
                          <div className="mb-4 rounded-lg bg-amber-50 p-4 border border-amber-200">
                            <p className="text-sm font-semibold text-amber-800 mb-2">
                              <span className="inline-flex items-center gap-2">
                                <Icon name="users" className="h-4 w-4" />
                                Anggota Kelompok ({anggotaList.length}):
                              </span>
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {anggotaList.map((anggota, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-amber-200">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                                    {idx + 1}
                                  </span>
                                  <span className="text-sm text-slate-800">{anggota.nama}</span>
                                  {anggota.nis && <span className="text-xs text-slate-400">({anggota.nis})</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {kelompokProgress ? (
                          <>
                            <div className="mb-4 rounded-lg bg-indigo-50 p-4 border border-indigo-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-800">
                                  <Icon name="chart" className="h-4 w-4" />
                                  Progress Pengerjaan
                                </span>
                                <span className="text-sm font-bold text-indigo-600">
                                  {kelompokProgress.completed_sintaks}/{kelompokProgress.total_sintaks} tahap ({kelompokProgress.completion_percentage}%)
                                </span>
                              </div>
                              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full transition-all duration-500"
                                  style={{ width: `${kelompokProgress.completion_percentage}%` }}
                                />
                              </div>
                            </div>

                            {DISPLAY_SINTAKS.length > 0 && (
                              <div className="mb-1 rounded-lg bg-purple-50 p-4 border border-purple-200">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-purple-800">
                                    <Icon name="clipboard" className="h-4 w-4" />
                                    Tahapan Pengerjaan:
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (expandedSintaks.length === DISPLAY_SINTAKS.length) {
                                        setExpandedSintaks([])
                                      } else {
                                        setExpandedSintaks(DISPLAY_SINTAKS.map((s) => s.id))
                                      }
                                    }}
                                    className="text-xs text-purple-600 hover:text-purple-800 font-semibold"
                                  >
                                    {expandedSintaks.length === DISPLAY_SINTAKS.length ? '▲ Tutup Semua' : '▼ Buka Semua'}
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {DISPLAY_SINTAKS.map((sintaks, idx) => {
                                    const isExpanded = expandedSintaks.includes(sintaks.id)
                                    const progressItems = Array.isArray(kelompokProgress?.progress) ? kelompokProgress.progress : []
                                    const sintaksProgress =
                                      progressItems.find((p: any) => Number(p?.urutan) === Number(sintaks.urutan)) ??
                                      progressItems.find((p: any) => String(p?.sintaks_id) === String(sintaks.urutan))
                                    const isCompleted = sintaksProgress?.completed || false

                                    return (
                                      <div key={sintaks.id} className={`bg-white rounded-lg border overflow-hidden ${isCompleted ? 'border-emerald-300' : 'border-purple-100'}`}>
                                        <div
                                          className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-purple-50"
                                          onClick={() => {
                                            if (isExpanded) {
                                              setExpandedSintaks(expandedSintaks.filter((id) => id !== sintaks.id))
                                            } else {
                                              setExpandedSintaks([...expandedSintaks, sintaks.id])
                                            }
                                          }}
                                        >
                                          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${isCompleted ? 'bg-emerald-500' : 'bg-purple-500'}`}>
                                            {isCompleted ? <Icon name="check" className="h-4 w-4" /> : idx + 1}
                                          </span>
                                          <span className="text-sm font-medium text-slate-800 flex-1">{sintaks.nama_fase || sintaks.judul || `Tahap ${idx + 1}`}</span>
                                          {isCompleted && (
                                            <span className="inline-flex items-center gap-2 rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">
                                              <Icon name="check" className="h-3.5 w-3.5" />
                                              Selesai
                                            </span>
                                          )}
                                          <span className="text-purple-500 text-xs">{isExpanded ? '▼' : '▶'}</span>
                                        </div>

                                        {isExpanded && (
                                          <div className="px-4 py-3 bg-purple-50/50 border-t border-purple-100 space-y-3">
                                            {sintaksProgress ? (
                                              <div className="space-y-2">
                                                {sintaksProgress.catatan && (
                                                  <div className="bg-emerald-50 rounded p-3 border border-emerald-200">
                                                    <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                                                      <Icon name="message" className="h-3.5 w-3.5" />
                                                      Catatan Progress:
                                                    </p>
                                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{sintaksProgress.catatan}</p>
                                                  </div>
                                                )}

                                                {(() => {
                                                  const url = buildStorageUrl(sintaksProgress.file_path)
                                                  if (!url) return null
                                                  const name = String(sintaksProgress.file_path ?? '').split('/').pop()

                                                  return (
                                                    <div className="bg-blue-50 rounded p-3 border border-blue-200">
                                                      <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-blue-700">
                                                        <Icon name="paperclip" className="h-3.5 w-3.5" />
                                                        File Lampiran:
                                                      </p>
                                                      <div className="flex items-center justify-between">
                                                        <span className="text-sm text-slate-700">{name}</span>
                                                        <a
                                                          href={url}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                                                        >
                                                          Unduh
                                                        </a>
                                                      </div>
                                                    </div>
                                                  )
                                                })()}

                                                {sintaksProgress.submitted_at && (
                                                  <p className="text-xs text-slate-500">
                                                    <span className="inline-flex items-center gap-2">
                                                      <Icon name="clock" className="h-3.5 w-3.5" />
                                                      {new Date(sintaksProgress.submitted_at).toLocaleString('id-ID', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                      })}
                                                    </span>
                                                  </p>
                                                )}

                                                {renderKontribusiIndividu(String(kelompok?.id ?? ''), sintaks)}
                                              </div>
                                            ) : (
                                              <div className="bg-slate-50 rounded p-3 border border-slate-200 text-center">
                                                <p className="text-sm text-slate-500">Belum ada progress untuk tahap ini</p>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                            Progress belum tersedia untuk kelompok ini.
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Main Project List View
  return (
    <div className="rounded-3xl bg-white p-4 sm:p-6 lg:p-7 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
            PBL Guru
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">Problem-Based Learning</h1>
          <p className="mt-2 text-sm text-slate-600">Guru bisa menambahkan project PBL, mengelola kelompok, dan melihat hasil.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            + Tambah Project PBL
          </button>
        )}
      </div>

      {showForm && (
        <form className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6" onSubmit={handleSubmit}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">
              {editingProject ? 'Edit Project PBL' : 'Buat Project PBL Baru'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                resetForm()
              }}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Tutup"
            >
              <Icon name="x" />
            </button>
          </div>
          <div className="space-y-6">
              {/* Info Dasar */}
              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Judul Project *</label>
                  <input
                    type="text"
                    value={formData.judul}
                    onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                    placeholder="Contoh: Sistem Informasi Perpustakaan"
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Kelas *</label>
                    <div className="rounded-xl border border-slate-200 bg-white p-3 max-h-40 overflow-y-auto">
                      {kelasList.length === 0 ? (
                        <p className="text-sm text-slate-500">Tidak ada kelas yang diampu</p>
                      ) : (
                        <div className="space-y-2">
                          {kelasList.map((k) => {
                            const checked = Array.isArray(formData.kelas_ids) && formData.kelas_ids.some((id) => String(id) === String(k.id))
                            return (
                              <label key={String(k.id)} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-lg px-2 py-1">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setFormData((prev) => {
                                      const current = Array.isArray(prev.kelas_ids) ? prev.kelas_ids : []
                                      const exists = current.some((id) => String(id) === String(k.id))
                                      const next = e.target.checked
                                        ? exists
                                          ? current
                                          : [...current, k.id]
                                        : current.filter((id) => String(id) !== String(k.id))

                                      return { ...prev, kelas_ids: next }
                                    })
                                  }}
                                  className="h-4 w-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                                />
                                <span className="text-sm text-slate-700">{k.nama}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Dipilih: {Array.isArray(formData.kelas_ids) ? formData.kelas_ids.length : 0} kelas
                    </p>
                    {kelasList.length === 0 && (
                      <p className="mt-1 text-xs text-red-500">
                        Anda belum diamanahi kelas. Hubungi admin.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Jurusan *</label>
                    <ResponsiveSelect
                      value={formData.jurusan_id}
                      onChange={(value) => setFormData({ ...formData, jurusan_id: value })}
                      placeholder="Pilih Jurusan"
                      emptyOptionLabel="Pilih Jurusan"
                      options={jurusanList.map((j) => ({
                        value: String(j.id),
                        label: j.nama_jurusan || j.nama || 'Jurusan',
                      }))}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Status *</label>
                    <ResponsiveSelect
                      value={formData.status}
                      onChange={(value) => setFormData({ ...formData, status: value as StatusPBL })}
                      placeholder="Pilih Status"
                      includeEmptyOption={false}
                      options={[
                        { value: 'Draft', label: 'Draf' },
                        { value: 'Aktif', label: 'Aktif' },
                        { value: 'Selesai', label: 'Selesai' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Deadline *</label>
                    <input
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
                >
                  {editingProject ? 'Simpan Perubahan' : 'Buat Project PBL'}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Project</th>
                <th className="hidden sm:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Kelas</th>
                <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Deadline</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Belum ada project PBL. Klik "Tambah Project PBL" untuk membuat.
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-slate-800">{project.judul}</div>
                      <div className="mt-1 text-xs text-slate-500 line-clamp-1">{project.masalah}</div>
                      <div className="mt-1 flex items-center gap-2 sm:hidden">
                        <span className="text-xs text-slate-600">{formatKelasLabel(project, kelasList, jurusanList)}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">
                          {new Date(project.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-center text-sm text-slate-600">
                      {formatKelasLabel(project, kelasList, jurusanList)}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-center text-xs text-slate-500">
                      {new Date(project.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                        project.status === 'Aktif' ? 'bg-green-100 text-green-700' :
                        project.status === 'Draft' ? 'bg-slate-100 text-slate-600' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {/* Mobile: Icon button with labels and scroll */}
                      <div className="flex items-center justify-end gap-2 overflow-x-auto md:hidden">
                        <button
                          onClick={() => viewKelompok(project)}
                          className="flex flex-col items-center gap-1 rounded-lg bg-amber-100 px-3 py-2 text-amber-800 hover:bg-amber-200 flex-shrink-0"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span className="text-[10px] font-semibold">Kelompok</span>
                        </button>
                        <button
                          onClick={() => viewSubmission(project)}
                          className="flex flex-col items-center gap-1 rounded-lg bg-emerald-100 px-3 py-2 text-emerald-800 hover:bg-emerald-200 flex-shrink-0"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-[10px] font-semibold">Hasil</span>
                        </button>
                        <button
                          onClick={() => handleEdit(project)}
                          className="flex flex-col items-center gap-1 rounded-lg bg-blue-100 px-3 py-2 text-blue-800 hover:bg-blue-200 flex-shrink-0"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span className="text-[10px] font-semibold">Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="flex flex-col items-center gap-1 rounded-lg bg-rose-100 px-3 py-2 text-rose-800 hover:bg-rose-200 flex-shrink-0"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="text-[10px] font-semibold">Hapus</span>
                        </button>
                      </div>
                      {/* Desktop: Text buttons */}
                      <div className="hidden md:flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => viewKelompok(project)}
                          className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                        >
                          Kelompok
                        </button>
                        <button
                          onClick={() => viewSubmission(project)}
                          className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-200"
                        >
                          Hasil
                        </button>
                        <button
                          onClick={() => handleEdit(project)}
                          className="rounded-lg bg-blue-100 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="rounded-lg bg-rose-100 px-2.5 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-200"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
    )
}
