import { useEffect, useMemo, useState } from 'react'
import { nilaiAPI, pblAPI, siswaAPI } from '../../lib/api'
import AchievementBadges from '../../components/pbl/AchievementBadges'
import { Icon } from '../../components/ui/Icon'
import { getSession } from '../../lib/auth'
import { tambahNotifikasi } from '../../lib/idbNotifikasi'

type PBLProject = {
  id: string
  judul: string
  masalah: string
  tujuan_pembelajaran: string
  panduan: string
  referensi?: string
  kelas?: string
  kelas_ids?: Array<string | number>
  kelas_list?: Array<{ id?: string | number; nama?: string; tingkat?: string }>
  status: string
  deadline: string
}

function formatKelasLabel(project: PBLProject): string {
  const list = Array.isArray(project.kelas_list) ? project.kelas_list : []
  if (list.length > 0) {
    const names = list
      .map((k) => (typeof k?.nama === 'string' ? k.nama.trim() : ''))
      .filter(Boolean)
    if (names.length > 0) return names.join(', ')
  }

  const raw = String(project.kelas ?? '').trim()
  if (!raw) return '-'

  const lowered = raw.toLowerCase()
  const isTingkatOnly = lowered === 'x' || lowered === 'xi' || lowered === 'xii'
  return isTingkatOnly ? `${raw} (tingkat)` : raw
}

type Sintaks = {
  id: string
  urutan: number
  nama_fase: string
  deskripsi: string
  instruksi: string
}

type ProgressItem = {
  sintaks_id: string
  urutan: number
  nama_fase?: string
  judul?: string
  catatan: string | null
  file_path: string | null
  completed: boolean
  submitted_at: string | null
}

type ProgressData = {
  pbl_id: string
  kelompok_id: string
  total_sintaks: number
  completed_sintaks: number
  completion_percentage: number
  progress: ProgressItem[]
}

type LeaderboardEntry = {
  submissionId: string
  kelompok_id: string
  kelompok_name: string
  nilai: number | null
  submitted_at?: string
  completion_percentage?: number | null
  completed_sintaks?: number | null
  total_sintaks?: number | null
  last_activity_at?: string
  // Optional: backend read-only leaderboard dapat mengirim ringkasan per-fase.
  // Bentuk yang didukung FE (supaya backward-compatible):
  // - `progress`: array item progress per sintaks berisi `urutan`/`sintaks_id` dan `submitted_at`.
  phase_progress?: Array<{
    sintaks_id?: string
    urutan?: number
    completed?: boolean
    submitted_at?: string | null
  }>
}

type LeaderboardRankRow = LeaderboardEntry & {
  skor: number
  bonus: number
  bonusLabel: 'fase' | 'cepat'
  submittedMs: number | null
  progressPct: number
}

type MyPblSubmission = {
  id: string
  kelompok_id: string
  nilai: number | null
  feedback: string | null
  submitted_at: string | null
  file_name?: string | null
}

type MyPblNilai = {
  id: string
  project_id: string
  kelompok_id: string | null
  nilai: number | null
  feedback: string | null
  tanggal: string | null
}

type JobdeskRole = 'Ketua' | 'Penyelidik' | 'Analis' | 'Notulis'

type MyKontribusi = {
  id: string
  pbl_id: string
  kelompok_id: string
  sintaks_id: string
  sintaks_urutan?: number
  siswa_id: string
  catatan: string
  file_path: string | null
  submitted_at: string | null
}

function normalizeJobdeskRole(value: unknown): JobdeskRole | null {
  const s = String(value ?? '').trim().toLowerCase()
  if (s === 'ketua') return 'Ketua'
  if (s === 'penyelidik') return 'Penyelidik'
  if (s === 'analis') return 'Analis'
  if (s === 'notulis') return 'Notulis'
  return null
}

function safeParseTimeMs(iso: unknown): number | null {
  if (typeof iso !== 'string' || iso.trim().length === 0) return null
  const ms = new Date(iso).getTime()
  return Number.isFinite(ms) ? ms : null
}

function clampNumber(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim().length > 0 ? Number(value) : NaN
  if (!Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, n))
}

function toSiswaKey(value: unknown): string {
  const s = String(value ?? '').trim()
  if (!s) return ''
  const match = s.match(/^siswa-(\d+)$/i)
  if (match?.[1]) return `siswa-${match[1]}`
  if (/^\d+$/.test(s)) return `siswa-${s}`
  return s
}

function computeGroupXp(progress: ProgressData, deadlineIso: string): { xp: number; level: number; nextLevelXp: number } {
  const completed = Number(progress.completed_sintaks ?? 0)
  const items = Array.isArray(progress.progress) ? progress.progress : []

  const catatanCount = items.filter((p) => typeof p?.catatan === 'string' && p.catatan.trim().length > 0).length
  const fileCount = items.filter((p) => p?.file_path != null).length

  const completionBonus = progress.completion_percentage === 100 ? 250 : 0

  let earlyBirdBonus = 0
  if (progress.completion_percentage === 100) {
    try {
      const deadline = new Date(deadlineIso)
      if (!Number.isNaN(deadline.getTime()) && new Date() < deadline) earlyBirdBonus = 150
    } catch {
      // ignore
    }
  }

  const xp = completed * 120 + catatanCount * 30 + fileCount * 40 + completionBonus + earlyBirdBonus

  const step = 250
  const level = Math.floor(xp / step) + 1
  const nextLevelXp = level * step

  return { xp, level, nextLevelXp }
}

export default function PBL() {
  const [projects, setProjects] = useState<PBLProject[]>([])
  const [selectedProject, setSelectedProject] = useState<PBLProject | null>(null)
  const [sintaksList, setSintaksList] = useState<Sintaks[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState(0)
  const [focusMode, setFocusMode] = useState(false)
  const [showGameTutorial, setShowGameTutorial] = useState(false)
  const [autoEnteredGame, setAutoEnteredGame] = useState(false)
  const [candiImageStatus, setCandiImageStatus] = useState<'unknown' | 'ready' | 'failed'>('unknown')

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)

  const [mySubmission, setMySubmission] = useState<MyPblSubmission | null>(null)
  const [mySubmissionLoading, setMySubmissionLoading] = useState(false)
  const [mySubmissionError, setMySubmissionError] = useState<string | null>(null)

  const [myNilai, setMyNilai] = useState<MyPblNilai | null>(null)
  const [myNilaiLoading, setMyNilaiLoading] = useState(false)
  const [myNilaiError, setMyNilaiError] = useState<string | null>(null)

  // Progress data dari API
  const [progressData, setProgressData] = useState<ProgressData | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(false)

  const [currentSiswaKey, setCurrentSiswaKey] = useState('')
  const [kelompokKetuaKey, setKelompokKetuaKey] = useState('')
  const [kelompokNama, setKelompokNama] = useState('')
  const [kelompokStudiKasus, setKelompokStudiKasus] = useState('')

  // Form state untuk progress per sintaks
  const [progressCatatan, setProgressCatatan] = useState<Record<string, string>>({})
  const [progressFile, setProgressFile] = useState<Record<string, File | null>>({})
  const [finalSubmissionFile, setFinalSubmissionFile] = useState<File | null>(null)
  const [savingProgress, setSavingProgress] = useState<string | null>(null)

  const [jobdeskRole, setJobdeskRole] = useState<JobdeskRole | null>(null)
  const [jobdeskAvailable, setJobdeskAvailable] = useState<boolean | null>(null)

  const [myKontribusiCatatan, setMyKontribusiCatatan] = useState<Record<string, string>>({})
  const [myKontribusiFile, setMyKontribusiFile] = useState<Record<string, File | null>>({})
  const [myKontribusiPrev, setMyKontribusiPrev] = useState<Record<string, MyKontribusi | null>>({})
  const [savingKontribusi, setSavingKontribusi] = useState<string | null>(null)
  const [kontribusiAvailable, setKontribusiAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    loadProjects()
  }, [])

  const pickInitialProject = useMemo(() => {
    if (!Array.isArray(projects) || projects.length === 0) return null

    const isActiveStatus = (status: unknown) => {
      const s = String(status ?? '').trim().toLowerCase()
      return s === 'aktif' || s === 'active' || s === 'published' || s === 'dipublikasikan'
    }

    const sorted = [...projects].sort((a, b) => {
      const aActive = isActiveStatus(a.status) ? 1 : 0
      const bActive = isActiveStatus(b.status) ? 1 : 0
      if (aActive !== bActive) return bActive - aActive

      const ad = a.deadline ? Date.parse(a.deadline) : Number.POSITIVE_INFINITY
      const bd = b.deadline ? Date.parse(b.deadline) : Number.POSITIVE_INFINITY
      if (Number.isFinite(ad) && Number.isFinite(bd) && ad !== bd) return ad - bd
      return String(a.judul ?? '').localeCompare(String(b.judul ?? ''))
    })

    return sorted[0] ?? null
  }, [projects])

  useEffect(() => {
    // Ambil ID siswa saat ini agar bisa menentukan ketua kelompok
    let cancelled = false
    ;(async () => {
      try {
        const res = await siswaAPI.me()
        if (!res?.success) return
        const data: any = (res as any).data
        // Backend kadang mengembalikan `id` sebagai `user.id`, sementara jobdesk memakai `siswa.id`.
        // Prioritaskan `siswa_id` jika ada agar key cocok dengan payload jobdesk.
        const id = data?.siswa_id ?? data?.id ?? data?.user?.id
        const key = toSiswaKey(id)
        if (!cancelled && key) setCurrentSiswaKey(key)
      } catch {
        // ignore
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // Untuk menentukan ketua: ambil kelompok untuk project, lalu ketua = anggota[0]
    if (!selectedProject?.id) return
    if (!progressData?.kelompok_id) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await pblAPI.getKelompok(selectedProject.id)
        if (!res?.success) return
        const list: any[] = Array.isArray((res as any)?.data)
          ? (res as any).data
          : Array.isArray((res as any)?.data?.data)
            ? (res as any).data.data
            : []

        const kelompok = list.find((k) => String(k?.id) === String(progressData.kelompok_id))
        if (!kelompok) return
        const ketua = Array.isArray(kelompok?.anggota) && kelompok.anggota.length > 0 ? kelompok.anggota[0] : ''
        const ketuaKey = toSiswaKey(ketua)
        const nama = typeof kelompok?.nama_kelompok === 'string' ? kelompok.nama_kelompok : ''
        const studiKasus = typeof kelompok?.studi_kasus === 'string' ? kelompok.studi_kasus : ''

        if (cancelled) return
        setKelompokKetuaKey(ketuaKey)
        setKelompokNama(nama)
        setKelompokStudiKasus(studiKasus)
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedProject?.id, progressData?.kelompok_id])

  useEffect(() => {
    // Reset saat pindah project / kelompok
    setKelompokStudiKasus('')
  }, [selectedProject?.id])

  useEffect(() => {
    // Best-effort: ambil jobdesk/role untuk siswa ini (jika backend mendukung).
    const pblId = selectedProject?.id
    const kelompokId = progressData?.kelompok_id
    if (!pblId || !kelompokId || !currentSiswaKey) {
      setJobdeskRole(null)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await pblAPI.getJobdesk(pblId, String(kelompokId))
        if (!res?.success) return
        setJobdeskAvailable(true)

        const jobdeskArr = Array.isArray(res?.data?.jobdesk) ? res.data.jobdesk : []
        if (jobdeskArr.length === 0) {
          if (!cancelled) setJobdeskRole(null)
          return
        }

        const mine = jobdeskArr.find((j) => toSiswaKey(j?.siswa_id) === currentSiswaKey)
        const role = normalizeJobdeskRole(mine?.role)
        if (!cancelled) setJobdeskRole(role)
      } catch (e: unknown) {
        const status = (e as any)?.status
        if (status === 404) {
          if (!cancelled) setJobdeskAvailable(false)
          return
        }
        // ignore (best-effort)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentSiswaKey, progressData?.kelompok_id, selectedProject?.id])

  useEffect(() => {
    // Best-effort: load kontribusi individu untuk sintaks aktif.
    const pblId = selectedProject?.id
    const sintaks = sintaksList?.[activeStep]
    if (!pblId || !sintaks?.id) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await pblAPI.getMyKontribusi(pblId, String(sintaks.id))
        if (!res?.success) return
        setKontribusiAvailable(true)

        const data = res.data
        if (data == null) {
          if (!cancelled) {
            setMyKontribusiPrev((prev) => ({ ...prev, [String(sintaks.id)]: null }))
          }
          return
        }
        const normalized: MyKontribusi = {
          id: String(data.id),
          pbl_id: String(data.pbl_id ?? pblId),
          kelompok_id: String(data.kelompok_id ?? ''),
          sintaks_id: String(data.sintaks_id ?? sintaks.id),
          sintaks_urutan:
            typeof data.sintaks_urutan === 'number'
              ? data.sintaks_urutan
              : undefined,
          siswa_id: String(data.siswa_id ?? ''),
          catatan: typeof data.catatan === 'string' ? data.catatan : String(data.catatan ?? ''),
          file_path: data.file_path == null ? null : String(data.file_path),
          submitted_at: data.submitted_at == null ? null : String(data.submitted_at),
        }

        if (cancelled) return
        setMyKontribusiPrev((prev) => ({ ...prev, [String(sintaks.id)]: normalized }))
        setMyKontribusiCatatan((prev) => {
          const existing = prev[String(sintaks.id)]
          if (typeof existing === 'string' && existing.trim().length > 0) return prev
          if (normalized.catatan.trim().length === 0) return prev
          return { ...prev, [String(sintaks.id)]: normalized.catatan }
        })
      } catch (e: unknown) {
        const status = (e as any)?.status
        if (status === 404) {
          if (!cancelled) setKontribusiAvailable(false)
          return
        }
        // ignore (best-effort)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeStep, selectedProject?.id, sintaksList])

  useEffect(() => {
    if (!selectedProject?.id) return
    void loadLeaderboard(selectedProject.id)
  }, [selectedProject?.id])

  useEffect(() => {
    // Load nilai + feedback untuk kelompok siswa (jika sudah submit)
    const projectId = selectedProject?.id
    const kelompokId = progressData?.kelompok_id
    if (!projectId || !kelompokId) {
      setMySubmission(null)
      setMySubmissionError(null)
      setMyNilai(null)
      setMyNilaiError(null)
      return
    }
    void loadMyGrade(projectId, String(kelompokId))
  }, [selectedProject?.id, progressData?.kelompok_id])

  useEffect(() => {
    // Reset file hasil saat ganti project
    setFinalSubmissionFile(null)
  }, [selectedProject?.id])

  const canEditProgressByRole = useMemo(() => {
    // Jika tidak bisa menentukan, jangan memblokir.
    if (!kelompokKetuaKey || !currentSiswaKey) return true
    return kelompokKetuaKey === currentSiswaKey
  }, [kelompokKetuaKey, currentSiswaKey])

  const hasAnyProgress = useMemo(() => {
    if (!progressData) return false
    const completed = Number(progressData.completed_sintaks ?? 0)
    const pct = Number(progressData.completion_percentage ?? 0)
    return completed > 0 || pct > 0
  }, [progressData])

  const isProjectLockedByGrade = useMemo(() => {
    // Lock hanya jika nilai sudah benar-benar relevan untuk project ini:
    // ada submission ATAU minimal ada progress, lalu ada nilai.
    const hasEvidence = Boolean(mySubmission) || hasAnyProgress
    if (!hasEvidence) return false
    const nilaiValue = mySubmission?.nilai ?? myNilai?.nilai ?? null
    return nilaiValue != null
  }, [hasAnyProgress, myNilai?.nilai, mySubmission])

  const canEditProgress = canEditProgressByRole && !isProjectLockedByGrade

  useEffect(() => {
    if (!focusMode) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [focusMode])

  async function loadProjects() {
    try {
      const response = await pblAPI.getAll()
      if (!response.success) return
      const list: any = (response as any).data?.data ?? (response as any).data
      if (Array.isArray(list)) {
        setProjects(list)
      }
    } catch (error) {
      console.error('Error loading PBL projects:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadProgress(projectId: string) {
    setLoadingProgress(true)
    try {
      const response = await pblAPI.getProgress(projectId)
      if (response.success && response.data) {
        setProgressData(response.data)
        // Populate form dengan data yang sudah ada
        const catatanMap: Record<string, string> = {}
        response.data.progress?.forEach((p) => {
          if (p.catatan) {
            catatanMap[p.sintaks_id] = p.catatan
          }
        })
        setProgressCatatan(catatanMap)
      }
    } catch (error: any) {
      // Suppress 403 error jika siswa belum terdaftar di kelompok
      // Error ini normal dan akan ditangani dengan pesan yang lebih user-friendly
      if (error?.status !== 403) {
        console.error('Error loading progress:', error)
      }
      setProgressData(null)
    } finally {
      setLoadingProgress(false)
    }
  }

  function resetToProjectList() {
    setFocusMode(false)
    setSelectedProject(null)
    setSintaksList([])
    setActiveStep(0)
    setProgressData(null)
    setProgressCatatan({})
    setProgressFile({})
    setLeaderboard([])
    setLeaderboardError(null)
    setCandiImageStatus('unknown')
    setJobdeskRole(null)
    setJobdeskAvailable(null)
    setMyKontribusiCatatan({})
    setMyKontribusiFile({})
    setMyKontribusiPrev({})
    setSavingKontribusi(null)
    setKontribusiAvailable(null)
  }

  async function selectProject(project: PBLProject, options?: { enterFocusMode?: boolean }) {
    const enterFocus = options?.enterFocusMode === true
    setSelectedProject(project)
    setActiveStep(0)
    setFocusMode(enterFocus)
    setProgressData(null)
    setProgressCatatan({})
    setProgressFile({})
    setCandiImageStatus('unknown')
    setLeaderboard([])
    setLeaderboardError(null)
    setJobdeskRole(null)
    setJobdeskAvailable(null)
    setMyKontribusiCatatan({})
    setMyKontribusiFile({})
    setMyKontribusiPrev({})
    setSavingKontribusi(null)
    setKontribusiAvailable(null)
    
    // Load sintaks
    try {
      const response = await pblAPI.getSintaks(project.id)
      if (response.success && Array.isArray(response.data)) {
        setSintaksList(response.data)
      }
    } catch (error) {
      console.error('Error loading sintaks:', error)
      setSintaksList([])
    }

    // Load progress
    await loadProgress(project.id)
  }

  useEffect(() => {
    // UX: saat pertama kali masuk halaman PBL, tonjolkan Mode Game.
    // Auto-select project awal (aktif/terdekat deadline) lalu masuk focus mode.
    if (loading) return
    if (autoEnteredGame) return
    if (selectedProject) return
    if (!pickInitialProject) return

    // Kalau project lebih dari 1, biarkan user memilih dulu dari list.
    if (projects.length > 1) {
      setAutoEnteredGame(true)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        await selectProject(pickInitialProject, { enterFocusMode: true })
        setAutoEnteredGame(true)
      } catch {
        if (cancelled) return
        setAutoEnteredGame(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [autoEnteredGame, loading, pickInitialProject, projects.length, selectedProject])

  function extractArrayFromPayload(payload: any): any[] {
    if (Array.isArray(payload)) return payload

    const directKeys = ['data', 'items', 'submissions', 'results', 'leaderboard', 'rows']
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

  function normalizeMySubmission(raw: any): MyPblSubmission | null {
    if (!raw || typeof raw !== 'object') return null
    const idRaw = (raw as any).id ?? (raw as any).submission_id
    const kelompokIdRaw = (raw as any).kelompok_id ?? (raw as any).kelompokId ?? (raw as any)?.kelompok?.id
    if (idRaw == null || kelompokIdRaw == null) return null

    const nilaiRaw = (raw as any).nilai
    const nilaiParsed =
      typeof nilaiRaw === 'number'
        ? nilaiRaw
        : typeof nilaiRaw === 'string' && nilaiRaw.trim().length > 0 && !Number.isNaN(Number(nilaiRaw))
          ? Number(nilaiRaw)
          : null

    const feedbackRaw = (raw as any).feedback
    const feedback = typeof feedbackRaw === 'string' ? feedbackRaw : feedbackRaw == null ? null : String(feedbackRaw)

    const submittedAt =
      typeof (raw as any).submitted_at === 'string'
        ? (raw as any).submitted_at
        : typeof (raw as any).created_at === 'string'
          ? (raw as any).created_at
          : typeof (raw as any).updated_at === 'string'
            ? (raw as any).updated_at
            : null

    const fileNameRaw = (raw as any).file_name ?? (raw as any).filename ?? (raw as any).file
    const file_name = fileNameRaw == null ? null : String(fileNameRaw)

    return {
      id: String(idRaw),
      kelompok_id: String(kelompokIdRaw),
      nilai: nilaiParsed,
      feedback: feedback && feedback.trim().length > 0 ? feedback : null,
      submitted_at: submittedAt,
      file_name,
    }
  }

  function normalizeMyNilai(raw: any): MyPblNilai | null {
    if (!raw || typeof raw !== 'object') return null
    const idRaw = (raw as any).id
    const projectIdRaw = (raw as any).project_id ?? (raw as any).pbl_id
    if (idRaw == null || projectIdRaw == null) return null

    const nilaiRaw = (raw as any).nilai ?? (raw as any).score
    const nilaiParsed =
      typeof nilaiRaw === 'number'
        ? nilaiRaw
        : typeof nilaiRaw === 'string' && nilaiRaw.trim().length > 0 && !Number.isNaN(Number(nilaiRaw))
          ? Number(nilaiRaw)
          : null

    const feedbackRaw = (raw as any).feedback
    const feedback = typeof feedbackRaw === 'string' ? feedbackRaw : feedbackRaw == null ? null : String(feedbackRaw)

    const tanggal =
      typeof (raw as any).tanggal === 'string'
        ? (raw as any).tanggal
        : typeof (raw as any).created_at === 'string'
          ? (raw as any).created_at
          : typeof (raw as any).updated_at === 'string'
            ? (raw as any).updated_at
            : null

    const kelompokIdRaw = (raw as any).kelompok_id ?? (raw as any)?.kelompok?.id

    return {
      id: String(idRaw),
      project_id: String(projectIdRaw),
      kelompok_id: kelompokIdRaw == null ? null : String(kelompokIdRaw),
      nilai: nilaiParsed,
      feedback: feedback && feedback.trim().length > 0 ? feedback : null,
      tanggal,
    }
  }

  function extractPblNilaiRows(payload: any): any[] {
    if (!payload) return []
    if (Array.isArray(payload?.pbl)) return payload.pbl
    if (Array.isArray(payload?.data?.pbl)) return payload.data.pbl

    // Kadang backend mengembalikan list flat.
    const arr = extractArrayFromPayload(payload)
    if (arr.length === 0) return []
    return arr.filter((row) => row?.project_id != null || row?.project_judul != null)
  }

  async function loadMyNilai(projectId: string, kelompokId: string) {
    try {
      setMyNilaiLoading(true)
      setMyNilaiError(null)

      const res = await nilaiAPI.getNilai({ type: 'pbl' })
      if (!res?.success) {
        setMyNilai(null)
        setMyNilaiError(res?.message || 'Gagal memuat nilai')
        return null
      }

      const rows = extractPblNilaiRows(res.data)
      const normalized = rows.map(normalizeMyNilai).filter(Boolean) as MyPblNilai[]
      const mine = normalized.filter((r) => String(r.project_id) === String(projectId) && (!r.kelompok_id || String(r.kelompok_id) === String(kelompokId)))

      if (mine.length === 0) {
        setMyNilai(null)
        return null
      }

      const latest = [...mine].sort((a, b) => {
        const ta = a.tanggal ? new Date(a.tanggal).getTime() : 0
        const tb = b.tanggal ? new Date(b.tanggal).getTime() : 0
        return tb - ta
      })[0]

      setMyNilai(latest)
      return latest
    } catch (error: any) {
      setMyNilai(null)
      setMyNilaiError(error?.message || 'Gagal memuat nilai')
      return null
    } finally {
      setMyNilaiLoading(false)
    }
  }

  async function loadMySubmission(projectId: string, kelompokId: string): Promise<{ submission: MyPblSubmission | null; forbidden: boolean }> {
    try {
      setMySubmissionLoading(true)
      setMySubmissionError(null)
      const res = await pblAPI.getSubmissions(projectId)
      if (!res?.success) {
        setMySubmission(null)
        setMySubmissionError(res?.message || 'Gagal memuat submission')
        return { submission: null, forbidden: false }
      }
      const rows = extractArrayFromPayload(res.data)
      const normalized = rows.map(normalizeMySubmission).filter(Boolean) as MyPblSubmission[]
      const mine = normalized.filter((s) => String(s.kelompok_id) === String(kelompokId))

      if (mine.length === 0) {
        setMySubmission(null)
        return { submission: null, forbidden: false }
      }

      // Jika ada duplikat, ambil yang terbaru
      const latest = [...mine].sort((a, b) => {
        const ta = a.submitted_at ? new Date(a.submitted_at).getTime() : 0
        const tb = b.submitted_at ? new Date(b.submitted_at).getTime() : 0
        return tb - ta
      })[0]

      setMySubmission(latest)
      return { submission: latest, forbidden: false }
    } catch (error: any) {
      const status = error?.status
      if (status === 403) {
        setMySubmission(null)
        setMySubmissionError('Submission tidak bisa dimuat. Menampilkan rekap nilai jika tersedia.')
        return { submission: null, forbidden: true }
      } else {
        setMySubmission(null)
        setMySubmissionError(error?.message || 'Gagal memuat submission')
        return { submission: null, forbidden: false }
      }
    } finally {
      setMySubmissionLoading(false)
    }
  }

  async function loadMyGrade(projectId: string, kelompokId: string) {
    // Selalu coba submission dulu (untuk tanggal submit + file). Jika tidak bisa,
    // fallback ke endpoint nilai yang sudah dipakai halaman Nilai siswa.
    const { submission, forbidden } = await loadMySubmission(projectId, kelompokId)

    // Jika submission dinilai, tidak perlu request tambahan.
    if (submission?.nilai != null) {
      setMyNilai(null)
      setMyNilaiError(null)
      return
    }

    // Jika submission belum ada / tidak bisa diakses, coba ambil nilai.
    const nilai = await loadMyNilai(projectId, kelompokId)
    if (nilai) {
      // Kalau nilai sudah ada, sembunyikan error submission (mis. 403) biar UX bersih.
      setMySubmissionError(null)
    }
    if (!nilai && forbidden) {
      // Pertahankan pesan ringan saja; badge/detail tetap akan menunjukkan '-' bila kosong.
      setMyNilaiError(null)
    }
  }

  function normalizeLeaderboardEntry(raw: any): LeaderboardEntry | null {
    if (!raw || typeof raw !== 'object') return null
    const kelompokIdRaw =
      (raw as any).kelompok_id ??
      (raw as any).kelompokId ??
      (raw as any)?.kelompok?.id
    if (kelompokIdRaw == null) return null

    // Backend leaderboard bisa mengembalikan kelompok yang belum submit:
    // `submission_id` null, `nilai` null, `submitted_at` null.
    // FE tetap harus menampilkannya, jadi pakai key sintetis bila submission_id tidak ada.
    const submissionIdRaw = (raw as any).submission_id ?? (raw as any).id
    const submissionId =
      submissionIdRaw == null || String(submissionIdRaw).trim().length === 0
        ? `kelompok-${String(kelompokIdRaw)}-no-submission`
        : String(submissionIdRaw)

    const kelompokName =
      (typeof (raw as any)?.kelompok?.nama_kelompok === 'string' && (raw as any).kelompok.nama_kelompok) ||
      (typeof (raw as any)?.nama_kelompok === 'string' && (raw as any).nama_kelompok) ||
      `Kelompok ${String(kelompokIdRaw)}`

    const nilaiRaw = (raw as any).nilai
    const nilaiParsed =
      typeof nilaiRaw === 'number'
        ? nilaiRaw
        : typeof nilaiRaw === 'string' && nilaiRaw.trim().length > 0 && !Number.isNaN(Number(nilaiRaw))
          ? Number(nilaiRaw)
          : null

    const completionPercentage =
      clampNumber(
        (raw as any).completion_percentage ??
          (raw as any).completionPercentage ??
          (raw as any).progress_percentage ??
          (raw as any).progressPercentage ??
          // Legacy alias: beberapa backend mengirim progres via `nilai`
          (raw as any).nilai,
        0,
        100
      ) ?? null
    const completedSintaks = clampNumber((raw as any).completed_sintaks ?? (raw as any).completedSintaks, 0, 9999)
    const totalSintaks = clampNumber((raw as any).total_sintaks ?? (raw as any).totalSintaks, 0, 9999)

    const lastActivityAt =
      typeof (raw as any).last_activity_at === 'string'
        ? (raw as any).last_activity_at
        : typeof (raw as any).lastActivityAt === 'string'
          ? (raw as any).lastActivityAt
          : undefined

    const submittedAt =
      typeof (raw as any).submitted_at === 'string'
        ? (raw as any).submitted_at
        : typeof (raw as any).created_at === 'string'
          ? (raw as any).created_at
          : typeof (raw as any).updated_at === 'string'
            ? (raw as any).updated_at
            : undefined

    const phaseProgressRaw =
      Array.isArray((raw as any).progress)
        ? (raw as any).progress
        : Array.isArray((raw as any).phase_progress)
          ? (raw as any).phase_progress
          : Array.isArray((raw as any).progress_items)
            ? (raw as any).progress_items
            : null

    const phase_progress = Array.isArray(phaseProgressRaw)
      ? phaseProgressRaw
          .map((p: any) => {
            if (!p || typeof p !== 'object') return null
            const urutanRaw = p.urutan ?? p.order ?? p.step
            const urutan = typeof urutanRaw === 'number' ? urutanRaw : typeof urutanRaw === 'string' ? Number(urutanRaw) : undefined
            const sintaksId = p.sintaks_id != null ? String(p.sintaks_id) : p.sintaksId != null ? String(p.sintaksId) : undefined
            const completed: boolean | undefined =
              typeof p.completed === 'boolean' ? p.completed : typeof p.is_completed === 'boolean' ? p.is_completed : undefined
            const submitted_at: string | null =
              typeof p.submitted_at === 'string'
                ? p.submitted_at
                : typeof p.updated_at === 'string'
                  ? p.updated_at
                  : typeof p.created_at === 'string'
                    ? p.created_at
                    : null

            if (urutan == null && !sintaksId && !submitted_at) return null
            return {
              sintaks_id: sintaksId,
              urutan: Number.isFinite(urutan as any) ? (urutan as number) : undefined,
              completed,
              submitted_at,
            }
          })
          .filter(
            (
              v
            ): v is {
              sintaks_id: string | undefined
              urutan: number | undefined
              completed: boolean | undefined
              submitted_at: string | null
            } => v != null
          )
      : undefined

    return {
      submissionId,
      kelompok_id: String(kelompokIdRaw),
      kelompok_name: String(kelompokName),
      nilai: nilaiParsed,
      submitted_at: submittedAt,
      completion_percentage: completionPercentage,
      completed_sintaks: completedSintaks,
      total_sintaks: totalSintaks,
      last_activity_at: lastActivityAt,
      phase_progress,
    }
  }

  async function loadLeaderboard(projectId: string) {
    try {
      setLeaderboardLoading(true)
      setLeaderboardError(null)
      let res: any = null
      try {
        res = await pblAPI.getLeaderboard(projectId)
      } catch (e: any) {
        // Backward-compat: backend lama belum punya endpoint leaderboard.
        if (e?.status === 404) {
          res = await pblAPI.getSubmissions(projectId)
        } else {
          throw e
        }
      }

      if (!res?.success) {
        setLeaderboard([])
        setLeaderboardError(res?.message || 'Gagal memuat leaderboard')
        return
      }

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[PBL] leaderboard response:', res)
      }

      const arr = extractArrayFromPayload(res.data)
      const normalized = arr.map(normalizeLeaderboardEntry)
      const entries = normalized.filter(Boolean) as LeaderboardEntry[]

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[PBL] leaderboard parsed:', { total: arr.length, valid: entries.length })
      }

      setLeaderboard(entries)
    } catch (error: any) {
      // If backend restricts this for siswa, don't break PBL page.
      const status = error?.status
      if (status === 403) {
        setLeaderboard([])
        setLeaderboardError('Leaderboard belum tersedia untuk siswa (akses dibatasi oleh backend).')
      } else {
        setLeaderboard([])
        setLeaderboardError(error?.message || 'Gagal memuat leaderboard')
      }
    } finally {
      setLeaderboardLoading(false)
    }
  }

  // Submit progress per sintaks
  async function handleSaveProgress(sintaksId: string) {
    if (!selectedProject) return
    if (isProjectLockedByGrade) {
      alert('Project ini sudah dinilai guru, progress kelompok dikunci dan tidak bisa diubah lagi.')
      return
    }
    if (!canEditProgress) {
      alert('Hanya ketua kelompok yang bisa mengisi dan menyimpan progress PBL.')
      return
    }

    const sintaks = sintaksList.find((s) => String(s.id) === String(sintaksId))
    const urutan = sintaks?.urutan != null ? Number(sintaks.urutan) : NaN
    const isFileRequiredSintaks = urutan === 4
    const isSubmitSintaks = urutan === 5

    const catatan = progressCatatan[sintaksId]?.trim()
    if (!catatan) {
      alert('Masukkan catatan progress terlebih dahulu.')
      return
    }

    try {
      setSavingProgress(sintaksId)
      const file = progressFile[sintaksId] || null
      if (isFileRequiredSintaks && !file) {
        alert('Untuk Sintaks 4, pilih file hasil (mis. ZIP/RAR) terlebih dahulu. File ini akan dikumpulkan pada Sintaks 5.')
        return
      }

      if (isFileRequiredSintaks && file) {
        // Simpan file hasil untuk dipakai saat kumpulkan di sintaks 5.
        setFinalSubmissionFile(file)
      }

      // Selalu simpan progress per sintaks agar progres/XP tetap terhitung.
      // File hasil tidak dikirim via progress; dikirim saat submit final (sintaks 5).
      const res = await pblAPI.submitProgress(selectedProject.id, sintaksId, {
        catatan,
        file: isFileRequiredSintaks || isSubmitSintaks ? null : file,
      })
      if (res.success) {
        if (isSubmitSintaks) {
          const kelompokId = progressData?.kelompok_id ? String(progressData.kelompok_id) : ''
          if (!kelompokId) {
            alert('Gagal mengumpulkan hasil: kelompok belum terdeteksi. Pastikan Anda sudah terdaftar dalam kelompok.')
          } else {
            if (!finalSubmissionFile) {
              alert('File hasil belum dipilih. Silakan pilih file pada Sintaks 4 terlebih dahulu, lalu kembali ke Sintaks 5 untuk mengumpulkan.')
            } else {
            try {
              const submitRes = await pblAPI.submitProject(selectedProject.id, {
                kelompok_id: kelompokId,
                file: finalSubmissionFile,
                catatan,
              })
              if (submitRes.success) {
                alert('Hasil akhir berhasil dikumpulkan!')
                setFinalSubmissionFile(null)
              } else {
                alert(submitRes.message || 'Progress tersimpan, tetapi gagal mengumpulkan hasil akhir.')
              }
            } catch (e: any) {
              alert(e?.message || 'Progress tersimpan, tetapi gagal mengumpulkan hasil akhir.')
            }
            }
          }
        } else {
          alert('Progress berhasil disimpan!')
        }

        try {
          const session = getSession()
          const email = session?.email ? String(session.email).trim() : ''
          if (email) {
            const fase = sintaksList.find((s) => String(s.id) === String(sintaksId))
            const faseNama = fase?.nama_fase?.trim() || 'Fase'
            await tambahNotifikasi({
              judul: isSubmitSintaks ? 'Hasil akhir PBL dikumpulkan' : 'Progress PBL tersimpan',
              pesan: isSubmitSintaks
                ? `"${selectedProject.judul}" — ${faseNama} berhasil dikumpulkan.`
                : `"${selectedProject.judul}" — ${faseNama} berhasil disimpan.`,
              tipe: 'pbl',
              targetSiswa: email,
            })
            window.dispatchEvent(new CustomEvent('notifikasi:changed'))
          }
        } catch {
          // ignore: notification is best-effort
        }

        // Reload progress data
        await loadProgress(selectedProject.id)
        // Clear file input after success
        setProgressFile((prev) => ({ ...prev, [sintaksId]: null }))
      }
    } catch (error: any) {
      console.error('Error saving progress:', error)
      const msg = String(error?.message || '').trim()
      const isForbidden = error?.status === 403
      const looksLikeKelompokMismatch = /belum\s+terdaftar.*kelompok/i.test(msg)

      if (isForbidden && looksLikeKelompokMismatch) {
        alert(
          `${msg}\n\nCatatan: Ini biasanya terjadi karena format ID anggota kelompok di backend tidak cocok (contoh: data kelompok menyimpan "siswa-11", tetapi backend mengecek angka 11). Perbaiki backend sesuai dokumen BACKEND_FIX_KELOMPOK_ID.md.`
        )
      } else {
        alert(msg || 'Gagal menyimpan progress. Pastikan Anda sudah terdaftar dalam kelompok.')
      }
    } finally {
      setSavingProgress(null)
    }
  }

  async function handleSaveKontribusi(sintaksId: string) {
    if (!selectedProject) return
    if (kontribusiAvailable === false) {
      alert('Kontribusi individu belum tersedia di backend. (Endpoint belum ada)')
      return
    }

    const catatan = (myKontribusiCatatan[sintaksId] ?? '').trim()
    if (!catatan) {
      alert('Masukkan catatan kontribusi terlebih dahulu.')
      return
    }

    const file = myKontribusiFile[sintaksId] || null
    // File bukti kontribusi bersifat opsional.

    try {
      setSavingKontribusi(sintaksId)
      const res = await pblAPI.submitMyKontribusi(selectedProject.id, sintaksId, { catatan, file })
      if (res?.success) {
        alert('Kontribusi individu berhasil disimpan!')
        setMyKontribusiFile((prevFiles) => ({ ...prevFiles, [sintaksId]: null }))

        // Refresh kontribusi terbaru
        try {
          const latest = await pblAPI.getMyKontribusi(selectedProject.id, sintaksId)
          if (latest?.success && latest?.data) {
            setMyKontribusiPrev((prevMap) => ({ ...prevMap, [sintaksId]: latest.data as any }))
          } else if (latest?.success && latest?.data == null) {
            setMyKontribusiPrev((prevMap) => ({ ...prevMap, [sintaksId]: null }))
          }
        } catch {
          // ignore
        }
      } else {
        alert(res?.message || 'Gagal menyimpan kontribusi individu.')
      }
    } catch (e: any) {
      if (e?.status === 404) {
        setKontribusiAvailable(false)
        alert('Kontribusi individu belum tersedia di backend. (Endpoint belum ada)')
        return
      }
      alert(String(e?.message || 'Gagal menyimpan kontribusi individu.'))
    } finally {
      setSavingKontribusi(null)
    }
  }

  // Get progress status for a sintaks
  function getProgressForSintaks(sintaksId: string): ProgressItem | undefined {
    return progressData?.progress?.find((p) => String(p.sintaks_id) === String(sintaksId))
  }

  // Phase theme colors (keep consistent across sintaks)
  const STEP_THEME = {
    bg: 'bg-amber-50',
    dot: 'bg-gradient-to-br from-amber-400 to-yellow-500',
  }

  const questNodes = useMemo(() => {
    return sintaksList.map((s, i) => {
      const prog = getProgressForSintaks(s.id)
      return {
        id: s.id,
        label: s.nama_fase,
        completed: !!prog?.completed,
        active: activeStep === i,
        index: i,
      }
    })
  }, [sintaksList, progressData, activeStep])

  const buildingModel = useMemo(() => {
    const nodes = Array.isArray(questNodes) ? questNodes : []
    const total = nodes.length
    const completed = nodes.filter((n) => n.completed).length
    return { nodes, total, completed }
  }, [questNodes])

  const groupProgression = useMemo(() => {
    if (!progressData || !selectedProject) return null
    return computeGroupXp(progressData, selectedProject.deadline)
  }, [progressData, selectedProject?.deadline])

  const leaderboardSorted = useMemo(() => {
    const items = Array.isArray(leaderboard) ? leaderboard : []
    const MAX_SPEED_BONUS = 10
    const PHASE_BONUS_TOP3 = [3, 2, 1] // per fase (rank 1..3)

    const hasPhaseTimes = items.some((it) => Array.isArray(it.phase_progress) && it.phase_progress.length > 0)

    const computePhaseBonusMap = (): Map<string, number> => {
      const bonusByKelompok = new Map<string, number>()
      if (!hasPhaseTimes) return bonusByKelompok

      // Build list of (phaseKey, kelompokId, timeMs)
      const phaseEvents: Array<{ phaseKey: string; kelompokId: string; timeMs: number }> = []

      for (const it of items) {
        const kelompokId = String(it.kelompok_id)
        const phases = Array.isArray(it.phase_progress) ? it.phase_progress : []
        for (const p of phases) {
          if (!p) continue
          if (p.completed === false) continue
          const t = typeof p.submitted_at === 'string' ? safeParseTimeMs(p.submitted_at) : null
          if (t == null) continue

          const phaseKey =
            p.urutan != null && Number.isFinite(p.urutan)
              ? `u:${p.urutan}`
              : p.sintaks_id
                ? `s:${p.sintaks_id}`
                : ''
          if (!phaseKey) continue

          phaseEvents.push({ phaseKey, kelompokId, timeMs: t })
        }
      }

      // Group by phaseKey and award top-3 fastest per phase.
      const byPhase = new Map<string, Array<{ kelompokId: string; timeMs: number }>>()
      for (const ev of phaseEvents) {
        if (!byPhase.has(ev.phaseKey)) byPhase.set(ev.phaseKey, [])
        byPhase.get(ev.phaseKey)!.push({ kelompokId: ev.kelompokId, timeMs: ev.timeMs })
      }

      for (const [, rows] of byPhase) {
        const sorted = [...rows].sort((a, b) => a.timeMs - b.timeMs)
        // Deduplicate kelompok (kalau backend ngirim beberapa event untuk fase yang sama)
        const seen = new Set<string>()
        const unique: Array<{ kelompokId: string; timeMs: number }> = []
        for (const r of sorted) {
          if (seen.has(r.kelompokId)) continue
          seen.add(r.kelompokId)
          unique.push(r)
        }

        for (let i = 0; i < Math.min(unique.length, PHASE_BONUS_TOP3.length); i++) {
          const kelompokId = unique[i].kelompokId
          const bonus = PHASE_BONUS_TOP3[i]
          bonusByKelompok.set(kelompokId, (bonusByKelompok.get(kelompokId) ?? 0) + bonus)
        }
      }

      return bonusByKelompok
    }

    const phaseBonusMap = computePhaseBonusMap()

    const withTime = items
      .map((it) => ({
        ...it,
        submittedMs: safeParseTimeMs(it.last_activity_at ?? it.submitted_at),
      }))
      .filter((it) => it.submittedMs != null) as Array<LeaderboardEntry & { submittedMs: number }>

    const minMs = withTime.length > 0 ? Math.min(...withTime.map((x) => x.submittedMs)) : null
    const maxMs = withTime.length > 0 ? Math.max(...withTime.map((x) => x.submittedMs)) : null
    const range = minMs != null && maxMs != null ? Math.max(0, maxMs - minMs) : null

    const ranked: LeaderboardRankRow[] = items.map((row) => {
      const submittedMs = safeParseTimeMs(row.last_activity_at ?? row.submitted_at)

      // Base score: progres pengerjaan (0-100)
      let progressPct =
        typeof row.completion_percentage === 'number'
          ? row.completion_percentage
          : typeof row.completed_sintaks === 'number' && typeof row.total_sintaks === 'number' && row.total_sintaks > 0
            ? (row.completed_sintaks / row.total_sintaks) * 100
            : 0
      progressPct = Math.min(100, Math.max(0, progressPct))

      // Bonus per fase (jika backend menyediakan timestamp per sintaks)
      const phaseBonus = phaseBonusMap.get(String(row.kelompok_id)) ?? 0

      // Fallback bonus cepat global (berdasarkan last_activity_at) bila tidak ada data per-fase.
      let speedBonus = 0
      if (!hasPhaseTimes && submittedMs != null && minMs != null) {
        if (range == null || range === 0) {
          speedBonus = MAX_SPEED_BONUS
        } else {
          const normalized = 1 - (submittedMs - minMs) / range // 1 paling cepat, 0 paling lambat
          speedBonus = Math.max(0, Math.min(MAX_SPEED_BONUS, Math.round(normalized * MAX_SPEED_BONUS)))
        }
      }

      const bonus = hasPhaseTimes ? phaseBonus : speedBonus
      const bonusLabel: 'fase' | 'cepat' = hasPhaseTimes ? 'fase' : 'cepat'

      // Skor gabungan: progres + bonus (bonus kecil agar tidak mengalahkan progres)
      const skor = progressPct + bonus

      return { ...row, skor, bonus, bonusLabel, submittedMs, progressPct }
    })

    return ranked.sort((a, b) => {
      // 1) Skor gabungan (progres + bonus cepat).
      const skorA = a.skor
      const skorB = b.skor
      if (skorB !== skorA) return skorB - skorA

      // 3) Jika skor sama, yang submit lebih cepat menang.
      const msA = a.submittedMs
      const msB = b.submittedMs
      if (msA != null && msB != null && msA !== msB) return msA - msB
      if (msA == null && msB != null) return 1
      if (msA != null && msB == null) return -1

      // 4) Stabil: nama kelompok.
      return a.kelompok_name.localeCompare(b.kelompok_name)
    })
  }, [leaderboard])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-slate-600">Memuat...</div>
      </div>
    )
  }

  if (selectedProject) {
    const questButtons = sintaksList.length > 0 && progressData && buildingModel.total > 0
    const activeStepSection =
      sintaksList.length > 0 && progressData && sintaksList[activeStep]
        ? (() => {
            const currentSintaks = sintaksList[activeStep]
            const currentProgress = getProgressForSintaks(currentSintaks.id)
            const currentCatatan = progressCatatan[currentSintaks.id] ?? ''
            const currentFile = progressFile[currentSintaks.id] ?? null
            const isSaving = savingProgress === currentSintaks.id
            const urutan = currentSintaks?.urutan != null ? Number(currentSintaks.urutan) : NaN
            const isFileRequiredSintaks = urutan === 4
            const isSubmitSintaks = urutan === 5
            const theme = STEP_THEME

            return (
              <div className="mb-8">
                {/* Phase Header Card */}
                <div className={`rounded-t-2xl ${theme.bg} border border-slate-200 border-b-0 px-5 py-4 sm:px-8 sm:py-5`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full ${currentProgress?.completed ? 'bg-emerald-500' : theme.dot} text-base sm:text-lg font-bold text-white shadow`}>
                        {currentProgress?.completed ? <Icon name="check" className="h-5 w-5" /> : activeStep + 1}
                      </span>
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-800 leading-tight">{currentSintaks.nama_fase}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Sintaks {activeStep + 1} dari {sintaksList.length}</p>
                      </div>
                    </div>
                    {currentProgress?.completed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                        Selesai
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        <Icon name="hourglass" className="h-4 w-4" />
                        Belum selesai
                      </span>
                    )}
                  </div>
                </div>

                {/* Instruksi + Form Card */}
                <div className="rounded-b-2xl bg-white shadow-lg overflow-hidden">
                  {/* Instruksi Section */}
                  <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-slate-100">
                    {Number(currentSintaks?.urutan) === 1 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-800 ring-1 ring-amber-200">
                            <Icon name="book" className="h-4 w-4" />
                          </span>
                          <p className="text-sm font-semibold text-slate-800">Studi Kasus Kelompok</p>
                        </div>
                        <div className="rounded-xl bg-amber-50 p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap ring-1 ring-amber-200">
                          {kelompokStudiKasus && kelompokStudiKasus.trim().length > 0
                            ? kelompokStudiKasus
                            : 'Guru belum mengisi studi kasus untuk kelompok ini.'}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                        <Icon name="clipboard" className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-semibold text-slate-700">Instruksi Pengerjaan</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {currentSintaks.instruksi || 'Tidak ada instruksi khusus.'}
                    </div>
                    {currentSintaks.deskripsi && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-slate-500 mb-1">Deskripsi:</p>
                        <p className="text-sm text-slate-500 whitespace-pre-wrap">{currentSintaks.deskripsi}</p>
                      </div>
                    )}
                  </div>

                  {/* Form Progress Section */}
                  <div className="px-5 py-5 sm:px-8 sm:py-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                        <Icon name="pencil" className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-bold text-slate-800">Tulis Jawaban / Progress</p>
                    </div>

                    {!canEditProgress && (
                      <div className="mb-4 rounded-xl bg-slate-50 p-4 text-xs text-slate-600 ring-1 ring-slate-200">
                        {isProjectLockedByGrade ? (
                          <>
                            Progress PBL untuk project ini sudah <b>dinilai guru</b>, jadi form kelompok dikunci.
                            Kamu tetap bisa melihat data yang ada.
                          </>
                        ) : (
                          <>
                            Progress PBL bersifat <b>kelompok</b>. Hanya <b>ketua kelompok</b> yang bisa mengisi dan menyimpan.
                          </>
                        )}
                        {kelompokNama ? ` (Kelompok: ${kelompokNama})` : ''}
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Catatan Textarea */}
                      <div>
                        <textarea
                          value={currentCatatan}
                          onChange={(e) => setProgressCatatan((prev) => ({ ...prev, [currentSintaks.id]: e.target.value }))}
                          disabled={!canEditProgress}
                          rows={6}
                          className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition placeholder:text-slate-400 resize-y"
                          placeholder="Tuliskan jawaban atau catatan progress kelompok Anda di sini...\n\nContoh:\n- Hasil diskusi kelompok\n- Temuan yang didapat\n- Langkah yang sudah dikerjakan"
                        />
                        <p className="mt-1 text-xs text-slate-400 text-right">
                          {currentCatatan.trim().length > 0 ? `${currentCatatan.trim().length} karakter` : 'Belum diisi'}
                        </p>
                      </div>

                      {/* File Upload */}
                      <div className="rounded-xl border-2 border-dashed border-slate-200 hover:border-amber-300 transition p-4 bg-slate-50/50">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
                            <Icon name="paperclip" className="h-4 w-4" />
                          </span>
                          <label className="text-sm font-medium text-slate-600">
                            {isFileRequiredSintaks ? 'File hasil akhir (wajib)' : 'Lampiran File (opsional)'}
                          </label>
                        </div>
                        <input
                          type="file"
                          onChange={(e) => setProgressFile((prev) => ({ ...prev, [currentSintaks.id]: e.target.files?.[0] ?? null }))}
                          disabled={!canEditProgress}
                          className="w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-amber-700 hover:file:bg-amber-200 file:cursor-pointer file:transition"
                        />
                        {currentFile && (
                          <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-white text-slate-700 ring-1 ring-slate-200">
                              <Icon name="document" className="h-3.5 w-3.5" />
                            </span>
                            {currentFile.name} ({(currentFile.size / 1024).toFixed(1)} KB)
                          </p>
                        )}
                        {currentProgress?.file_path && !currentFile && (
                          <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-white text-emerald-700 ring-1 ring-slate-200">
                              <Icon name="check" className="h-3.5 w-3.5" />
                            </span>
                            File sebelumnya: {currentProgress.file_path.split('/').pop()}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isSaving || !canEditProgress}
                        onClick={() => handleSaveProgress(currentSintaks.id)}
                        className="w-full rounded-xl bg-amber-500 px-5 py-3 text-sm sm:text-base font-bold text-white shadow-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {!canEditProgress ? (
                          isProjectLockedByGrade
                            ? 'Sudah dinilai - terkunci'
                            : 'Hanya ketua yang bisa menyimpan'
                        ) : isSaving ? (
                          isSubmitSintaks ? 'Mengumpulkan...' : 'Menyimpan...'
                        ) : (
                          <span className="inline-flex items-center justify-center gap-2">
                            <Icon name={isSubmitSintaks ? 'send' : 'save'} className="h-4 w-4" />
                            {isSubmitSintaks ? 'Kumpulkan Hasil' : 'Simpan Progress'}
                          </span>
                        )}
                      </button>

                      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-800">Kontribusi Individu</p>
                          {jobdeskRole ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{jobdeskRole}</span>
                          ) : jobdeskAvailable === false ? (
                            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">Jobdesk belum tersedia</span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Role belum diatur</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-600">Setiap anggota wajib mengisi catatan. Upload bukti bersifat opsional.</p>

                        {kontribusiAvailable === false ? (
                          <div className="mt-3 rounded-lg bg-white p-3 text-xs text-slate-600 ring-1 ring-slate-200">
                            Fitur kontribusi individu belum tersedia di backend.
                          </div>
                        ) : (
                          <div className="mt-3 space-y-3">
                            <div>
                              <textarea
                                value={myKontribusiCatatan[currentSintaks.id] ?? ''}
                                onChange={(e) => setMyKontribusiCatatan((prev) => ({ ...prev, [currentSintaks.id]: e.target.value }))}
                                rows={4}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition placeholder:text-slate-400 resize-y"
                                placeholder="Tulis kontribusi pribadimu untuk sintaks ini (singkat tapi jelas)."
                              />
                            </div>

                            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                                  <Icon name="paperclip" className="h-4 w-4" />
                                </span>
                                <label className="text-sm font-medium text-slate-700">Upload bukti (opsional)</label>
                              </div>
                              <input
                                type="file"
                                onChange={(e) => setMyKontribusiFile((prev) => ({ ...prev, [currentSintaks.id]: e.target.files?.[0] ?? null }))}
                                className="w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-200 file:cursor-pointer file:transition"
                              />

                              {myKontribusiFile[currentSintaks.id] && (
                                <p className="mt-2 text-xs text-slate-500">
                                  File dipilih: {myKontribusiFile[currentSintaks.id]!.name}
                                </p>
                              )}

                              {myKontribusiPrev[currentSintaks.id]?.file_path && !myKontribusiFile[currentSintaks.id] && (
                                <p className="mt-2 text-xs text-emerald-700">
                                  File sebelumnya: {String(myKontribusiPrev[currentSintaks.id]!.file_path).split('/').pop()}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              disabled={savingKontribusi === currentSintaks.id}
                              onClick={() => handleSaveKontribusi(currentSintaks.id)}
                              className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm sm:text-base font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                              {savingKontribusi === currentSintaks.id ? 'Menyimpan kontribusi...' : 'Simpan Kontribusi Saya'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()
        : null

    const GameTutorialOverlay = () => {
      if (!showGameTutorial) return null

      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-amber-50 p-5 shadow-xl ring-1 ring-amber-200">
            <button
              type="button"
              onClick={() => setShowGameTutorial(false)}
              className="absolute right-3 top-3 rounded-lg bg-white/70 px-2 py-1 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-white"
              aria-label="Tutup tutorial"
            >
              <Icon name="x" />
            </button>

            <div className="text-center">
              <div className="flex justify-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-amber-700 ring-1 ring-slate-200">
                  <Icon name="gamepad" size="lg" />
                </span>
              </div>
              <div className="mt-2 text-xl font-extrabold text-amber-800">Cara Mengerjakan (Mode Game)</div>
              <div className="mt-1 text-xs text-slate-600">Quest per sintaks untuk membangun Candi kelompokmu.</div>
            </div>

            <div className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto pr-1 text-sm text-slate-800">
              <div className="rounded-xl bg-white/70 p-3 ring-1 ring-amber-200">
                <div className="text-xs font-black tracking-wide text-amber-700">Tujuan</div>
                <div className="mt-2 text-sm leading-relaxed text-slate-800">
                  Kamu dan kelompokmu menuntaskan sintaks satu per satu. Setiap sintaks yang selesai = satu langkah membangun Candi.
                  Semakin rapi progress kalian dan semakin cepat menyelesaikan sintaks (tanpa mengorbankan kualitas), semakin tinggi posisi di leaderboard.
                </div>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <div className="text-xs font-black tracking-wide text-slate-700">Langkah Pengerjaan</div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-slate-200">
                      <Icon name="compass" />
                    </span>
                    <span>
                      <b>Pilih sintaks</b> lewat kartu <b>Quest Sintaks</b> (dikerjakan berurutan).
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-slate-200">
                      <Icon name="pin" />
                    </span>
                    <span>
                      Baca <b>Instruksi Pengerjaan</b> untuk tahu target minimal yang harus ada di catatan/hasil kerja.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
                      <Icon name="note" />
                    </span>
                    <span>
                      Isi <b>Jawaban/Progress</b> (catatan kelompok). Tulis poin penting: hasil diskusi, langkah kerja, data/sumber, dan kesimpulan.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-slate-200">
                      <Icon name="users" />
                    </span>
                    <span>
                      Setiap anggota mengisi <b>Kontribusi Individu</b> (catatan pribadi). <b>Upload bukti opsional</b>, tapi sangat disarankan bila ada.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
                      <Icon name="paperclip" />
                    </span>
                    <span>
                      (Opsional) <b>Lampirkan file</b> sebagai bukti: dokumen, gambar, atau berkas pendukung. Jika sudah pernah upload, kamu akan lihat “file sebelumnya”.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-slate-200">
                      <Icon name="save" />
                    </span>
                    <span>
                      Klik <b>Simpan Progress</b> untuk menyimpan perubahan. Kalau belum selesai, tetap boleh simpan sebagai draft.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-slate-200">
                      <Icon name="check" />
                    </span>
                    <span>
                      Kalau sudah sesuai instruksi, tandai sintaks <b>Selesai</b>. Setelah itu, lanjut ke sintaks berikutnya.
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <div className="text-xs font-black tracking-wide text-slate-700">Aturan Tim</div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-slate-200">
                      <Icon name="crown" />
                    </span>
                    <span>
                      <b>Ketua kelompok</b> biasanya menyimpan <b>progress kelompok</b>. Anggota lain tetap bisa mengisi dan menyimpan <b>kontribusi individu</b> masing-masing.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
                      <Icon name="users" />
                    </span>
                    <span>
                      Kerja bareng: diskusi dulu, lalu ketua menuliskan rangkuman hasilnya supaya catatan rapi dan konsisten.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
                      <Icon name="repeat" />
                    </span>
                    <span>
                      Boleh <b>update</b> catatan/lampiran sebelum dinyatakan selesai. Simpan berkala biar tidak hilang.
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <div className="text-xs font-black tracking-wide text-slate-700">Skor, XP, dan Leaderboard</div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
                      <Icon name="chart" />
                    </span>
                    <span>
                      <b>Progres</b> dihitung dari berapa sintaks yang sudah selesai. Progres ini yang utama untuk ranking.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-slate-200">
                      <Icon name="bolt" />
                    </span>
                    <span>
                      Ada <b>bonus fase</b>: untuk tiap sintaks, <b>3 kelompok tercepat</b> dapat bonus <b>+3 / +2 / +1</b>.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-slate-200">
                      <Icon name="medal" />
                    </span>
                    <span>
                      <b>Level Kelompok</b> naik dari XP. XP biasanya bertambah dari sintaks selesai, catatan, lampiran, dan penyelesaian sebelum deadline.
                    </span>
                  </div>
                  <div className="pt-1 text-xs text-slate-600">
                    Catatan: fokus utama tetap kualitas jawaban. Bonus cepat itu tambahan motivasi, bukan satu-satunya penentu.
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <div className="text-xs font-black tracking-wide text-slate-700">Navigasi</div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
                      <Icon name="swap" />
                    </span>
                    <span>
                      Tombol <b>Ganti Project</b> untuk kembali ke daftar project dan memilih yang lain.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
                      <Icon name="exit" />
                    </span>
                    <span>
                      Tombol <b>Keluar</b> untuk keluar dari Mode Game dan kembali ke tampilan project.
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-amber-100/60 p-3 ring-1 ring-amber-200">
                <div className="text-xs font-black tracking-wide text-amber-800">Tips Cepat</div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-amber-700 ring-1 ring-slate-200">
                      <Icon name="sparkle" />
                    </span>
                    <span>
                      Tulis catatan pakai poin-poin (bullet) biar jelas: <b>apa</b> yang dikerjakan, <b>bagaimana</b>, dan <b>hasilnya</b>.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
                      <Icon name="document" />
                    </span>
                    <span>
                      Kalau ada bukti (foto, dokumen, data), lampirkan—ini bikin progress lebih meyakinkan.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
                      <Icon name="hourglass" />
                    </span>
                    <span>
                      Kejar bonus cepat boleh, tapi pastikan instruksi terpenuhi dulu.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setShowGameTutorial(false)}
                className="rounded-xl bg-amber-500 px-6 py-2 text-sm font-bold text-white shadow hover:bg-amber-600"
              >
                <span className="inline-flex items-center gap-2">
                  Mengerti, lanjut!
                  <Icon name="rocket" className="h-4 w-4" />
                </span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    const LeaderboardCard = ({ compact }: { compact?: boolean }) => {
      const limit = compact ? 5 : 10
      return (
        <div className={compact ? 'rounded-xl bg-white p-3 ring-1 ring-slate-200' : 'mb-8 rounded-2xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-slate-200'}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={compact ? 'text-sm font-bold text-slate-800 flex items-center gap-2' : 'text-sm font-bold text-slate-800 flex items-center gap-2'}>
                <Icon name="trophy" className="h-4 w-4" />
                Leaderboard Kelompok
              </div>
              <div className={compact ? 'mt-0.5 text-[11px] text-slate-600' : 'mt-1 text-xs text-slate-600'}>
                Ranking berdasarkan progres pengerjaan + bonus cepat.
              </div>
            </div>
          </div>

          {leaderboardLoading ? (
            <div className={compact ? 'mt-2 text-xs text-slate-500' : 'mt-3 text-sm text-slate-500'}>Memuat leaderboard...</div>
          ) : leaderboardError ? (
            <div className={compact ? 'mt-2 text-xs text-slate-500' : 'mt-3 text-sm text-slate-500'}>{leaderboardError}</div>
          ) : leaderboardSorted.length === 0 ? (
            <div className={compact ? 'mt-2 text-xs text-slate-500' : 'mt-3 text-sm text-slate-500'}>
              Belum ada data leaderboard untuk project ini.
            </div>
          ) : (
            <div className={compact ? 'mt-3 space-y-2' : 'mt-4 space-y-2'}>
              {leaderboardSorted.slice(0, limit).map((row, idx) => {
                const isMine = progressData?.kelompok_id && String(progressData.kelompok_id) === String(row.kelompok_id)
                const bonusLabelText = row.bonusLabel === 'fase' ? 'Bonus fase' : 'Bonus cepat'
                return (
                  <div
                    key={row.submissionId}
                    className={
                      'flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ' +
                      (isMine ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white')
                    }
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className={
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ' +
                          (idx === 0
                            ? 'bg-amber-100 text-amber-700'
                            : idx === 1
                              ? 'bg-slate-100 text-slate-700'
                              : idx === 2
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-slate-50 text-slate-600')
                        }
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className={compact ? 'truncate text-xs font-bold text-slate-800' : 'truncate text-sm font-bold text-slate-800'}>
                          {row.kelompok_name}{isMine ? ' (Kamu)' : ''}
                        </div>
                        <div className={compact ? 'mt-0.5 text-[10px] text-slate-500' : 'mt-0.5 text-[11px] text-slate-500'}>
                          Progres: {Math.round(row.progressPct)}% <span className="mx-1">•</span> {bonusLabelText}: +{row.bonus}
                        </div>
                      </div>
                    </div>

                    <div className={compact ? 'shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800' : 'shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800'}>
                      {Math.round(row.progressPct)}%
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    const GradeCard = ({ compact }: { compact?: boolean }) => {
      if (!progressData) return null
      const hasEvidence = Boolean(mySubmission) || hasAnyProgress
      const nilaiValue = hasEvidence ? (mySubmission?.nilai ?? myNilai?.nilai ?? null) : null
      const feedbackValue = hasEvidence ? (mySubmission?.feedback ?? myNilai?.feedback ?? null) : null
      const isScored = nilaiValue != null

      const whenIso = mySubmission?.submitted_at ?? myNilai?.tanggal
      const submittedLabel = whenIso ? new Date(whenIso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : null

      const combinedLoading = mySubmissionLoading || myNilaiLoading
      const combinedError = hasEvidence && myNilai ? null : (myNilaiError ?? mySubmissionError)

      return (
        <div className={compact ? 'rounded-xl bg-white p-3 ring-1 ring-slate-200' : 'mb-8 rounded-2xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-slate-200'}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className={compact ? 'text-sm font-bold text-slate-800 flex items-center gap-2' : 'text-sm font-bold text-slate-800 flex items-center gap-2'}>
                <Icon name="medal" className="h-4 w-4" />
                Penilaian Guru
              </div>
              <div className={compact ? 'mt-0.5 text-[11px] text-slate-600' : 'mt-1 text-xs text-slate-600'}>
                Nilai dan feedback untuk submission kelompokmu.
              </div>
            </div>
            <div
              className={
                compact
                  ? 'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold '
                  : 'shrink-0 rounded-full px-3 py-1 text-xs font-bold '
              }
            >
              {mySubmissionLoading ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Memuat...</span>
              ) : isScored ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">Dinilai</span>
              ) : mySubmission ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">Menunggu</span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Belum submit</span>
              )}
            </div>
          </div>

          {combinedError && (
            <div className={compact ? 'mt-2 text-[11px] text-slate-500' : 'mt-3 text-sm text-slate-500'}>{combinedError}</div>
          )}

          {!combinedLoading && (
            <div className={compact ? 'mt-3 space-y-2' : 'mt-4 space-y-2'}>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-semibold text-slate-500">Nilai</div>
                  <div className="mt-0.5 text-2xl font-black text-slate-800">
                    {isScored ? nilaiValue : '-'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-semibold text-slate-500">Terakhir submit</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">{submittedLabel ?? '-'}</div>
                  {mySubmission?.file_name && (
                    <div className="mt-0.5 text-[11px] text-slate-500">File: {mySubmission.file_name}</div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-[11px] font-semibold text-slate-500">Feedback</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {feedbackValue ? feedbackValue : isScored ? 'Tidak ada feedback.' : 'Belum ada feedback karena belum dinilai.'}
                </div>
              </div>
            </div>
          )}
        </div>
      )
    }

    const QuestButtonsUI = ({ compact }: { compact?: boolean }) => {
      if (!questButtons) return null
      const nodes = buildingModel.nodes

      const wrapClass = compact ? 'flex gap-2 overflow-x-auto pb-1' : 'grid gap-2 sm:grid-cols-2'
      const buttonBase = compact
        ? 'min-w-[190px]'
        : ''

      return (
        <div className={compact ? 'rounded-xl bg-white p-3 ring-1 ring-slate-200' : 'mb-8 rounded-2xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-slate-200'}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-800">Quest Sintaks</div>
              <div className="mt-1 text-xs text-slate-600">Klik untuk pindah sintaks (urut).</div>
            </div>
            {!compact && (
              <div className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {buildingModel.completed}/{buildingModel.total}
              </div>
            )}
          </div>

          <div className={compact ? 'mt-3' : 'mt-4'}>
            <div className={wrapClass}>
              {nodes.map((node, idx) => {
                const prevCompleted = idx === 0 ? true : !!nodes[idx - 1]?.completed
                const unlocked = prevCompleted || !!node.completed
                const isActive = idx === activeStep
                const isCompleted = !!node.completed

                const stateClass = !unlocked
                  ? 'border-slate-200 bg-slate-50 text-slate-400'
                  : isCompleted
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : isActive
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'

                return (
                  <button
                    key={node.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => setActiveStep(idx)}
                    className={`${buttonBase} rounded-xl border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed ${stateClass}`}
                    title={!unlocked ? 'Selesaikan sintaks sebelumnya dulu' : node.label}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold leading-tight">
                        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/5 text-xs font-bold">
                          {idx + 1}
                        </span>
                        {node.label}
                      </div>
                      <div className="text-xs font-bold">
                        {isCompleted ? (
                          <Icon name="check" className="h-4 w-4" />
                        ) : isActive ? (
                          <Icon name="play" className="h-4 w-4" />
                        ) : !unlocked ? (
                          <Icon name="lock" className="h-4 w-4" />
                        ) : null}
                      </div>
                    </div>
                    {!compact && (
                      <div className="mt-1 text-[11px] text-slate-500">
                        {isCompleted ? 'Selesai' : isActive ? 'Sedang dikerjakan' : unlocked ? 'Tersedia' : 'Terkunci'}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )
    }

    const TempleBoard = ({ variant }: { variant?: 'compact' | 'wide' }) => {
      if (!progressData || buildingModel.total === 0) return null
      const isCompact = variant === 'compact'
      const maxStage = Math.max(1, Math.min(6, buildingModel.total))
      const stage = Math.min(maxStage, Math.max(0, buildingModel.completed))
      const unlocked = (n: number) => stage >= n
      const reveal = maxStage > 0 ? Math.min(1, Math.max(0, stage / maxStage)) : 0

      const showReferenceImage = candiImageStatus !== 'failed'
      const referenceImageReady = candiImageStatus === 'ready'

      const outerClass = isCompact
        ? 'rounded-xl bg-white p-3 ring-1 ring-slate-200'
        : 'rounded-2xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-slate-200'

      const boardHeightClass = isCompact ? 'h-44' : 'h-56'
      const imageWrapClass = isCompact ? 'relative h-40 w-full max-w-[240px]' : 'relative h-52 w-full max-w-[320px]'

      return (
        <div className={outerClass}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-800">{isCompact ? 'Candi Kelompok' : 'Progress Proyek (Candi)'}</div>
              <div className="mt-1 text-xs text-slate-600">Candi terbentuk tiap sintaks selesai.</div>
            </div>
            <div className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              {buildingModel.completed}/{buildingModel.total}
            </div>
          </div>

          <div className="mt-4">
            <div className="mx-auto w-full max-w-sm rounded-2xl bg-gradient-to-b from-slate-50 to-white p-3 ring-1 ring-slate-200">
              <div className={`relative mx-auto w-full ${boardHeightClass}`}>
                {/* Sky */}
                <div className="absolute inset-x-0 top-0 h-24 rounded-2xl bg-slate-100" />

                {/* Reference-image mode (optional): place image at /public/pbl-candi.png */}
                {showReferenceImage && (
                  <div className="absolute inset-0 z-10 flex items-end justify-center pb-1">
                    <div className={imageWrapClass}>
                      <img
                        src="/pbl-candi.png"
                        alt="Candi kelompok"
                        className="absolute inset-0 h-full w-full object-contain opacity-70 grayscale"
                        onLoad={() => setCandiImageStatus('ready')}
                        onError={() => setCandiImageStatus('failed')}
                        draggable={false}
                      />
                      <img
                        src="/pbl-candi.png"
                        alt="Candi kelompok"
                        className="absolute inset-0 h-full w-full object-contain"
                        style={{
                          clipPath: `inset(${Math.round((1 - reveal) * 100)}% 0% 0% 0% round 18px)`,
                          transition: 'clip-path 500ms ease',
                        }}
                        onLoad={() => setCandiImageStatus('ready')}
                        onError={() => setCandiImageStatus('failed')}
                        draggable={false}
                      />
                    </div>
                  </div>
                )}

                {/* Base platform */}
                <div className="absolute inset-x-2 bottom-0 h-5 rounded-2xl bg-slate-200 ring-1 ring-slate-300" />

                {/* Candi base + tangga (stage 1) */}
                {!referenceImageReady && (
                  <>
                    <div
                      className={`absolute left-1/2 bottom-5 h-6 w-60 -translate-x-1/2 rounded-2xl ring-1 ring-slate-200 transition-all duration-500 ${
                        unlocked(1) ? 'bg-gradient-to-r from-emerald-50 via-amber-50 to-emerald-50' : 'bg-slate-200 opacity-60'
                      }`}
                    />
                    <div
                      className={`absolute left-1/2 bottom-5 -translate-x-1/2 transition-all duration-500 ${
                        unlocked(1) ? 'opacity-100' : 'opacity-60'
                      }`}
                    >
                      <div className="relative h-10 w-24">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className={`absolute left-1/2 -translate-x-1/2 rounded-xl ring-1 ring-slate-200 ${
                              unlocked(1) ? 'bg-gradient-to-r from-amber-300 to-amber-500' : 'bg-slate-200'
                            }`}
                            style={{
                              bottom: 2 + i * 2,
                              width: 88 - i * 12,
                              height: 10,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Badan candi + pintu (stage 2) */}
                {!referenceImageReady && maxStage >= 2 && (
                  <div
                    className={`absolute left-1/2 bottom-12 -translate-x-1/2 transition-all duration-500 ${
                      unlocked(2) ? 'opacity-100' : 'opacity-35 grayscale'
                    }`}
                  >
                    <div className="relative h-24 w-32">
                      {/* outer body */}
                      <div
                        className={`absolute inset-0 rounded-2xl ring-1 ring-slate-200 ${
                          unlocked(2) ? 'bg-gradient-to-b from-amber-200 to-amber-500' : 'bg-slate-200'
                        }`}
                      />
                      {/* side wings */}
                      <div
                        className={`absolute bottom-2 -left-5 h-16 w-10 rounded-2xl ring-1 ring-slate-200 ${
                          unlocked(2) ? 'bg-gradient-to-b from-amber-200 to-amber-500' : 'bg-slate-200'
                        }`}
                      />
                      <div
                        className={`absolute bottom-2 -right-5 h-16 w-10 rounded-2xl ring-1 ring-slate-200 ${
                          unlocked(2) ? 'bg-gradient-to-b from-amber-200 to-amber-500' : 'bg-slate-200'
                        }`}
                      />

                      {/* doorway */}
                      <div className="absolute bottom-2 left-1/2 h-14 w-12 -translate-x-1/2 rounded-t-2xl bg-slate-50 ring-1 ring-slate-200" />
                      <div className="absolute bottom-3 left-1/2 h-12 w-10 -translate-x-1/2 rounded-t-2xl bg-slate-200/60" />

                      {/* small relief blocks */}
                      <div className="absolute left-3 top-5 h-4 w-7 rounded-xl bg-slate-100 ring-1 ring-slate-200" />
                      <div className="absolute right-3 top-5 h-4 w-7 rounded-xl bg-slate-100 ring-1 ring-slate-200" />
                      <div className="absolute left-3 top-12 h-4 w-7 rounded-xl bg-slate-100 ring-1 ring-slate-200" />
                      <div className="absolute right-3 top-12 h-4 w-7 rounded-xl bg-slate-100 ring-1 ring-slate-200" />
                    </div>
                  </div>
                )}

                {/* Atap bertingkat (stage 3-5) */}
                {!referenceImageReady && maxStage >= 3 && (
                  <div
                    className={`absolute left-1/2 bottom-[124px] h-8 w-44 -translate-x-1/2 rounded-[26px] ring-1 ring-slate-200 transition-all duration-500 ${
                      unlocked(3) ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-slate-200'
                    }`}
                  />
                )}
                {!referenceImageReady && maxStage >= 4 && (
                  <div
                    className={`absolute left-1/2 bottom-[145px] h-7 w-34 -translate-x-1/2 rounded-[24px] ring-1 ring-slate-200 transition-all duration-500 ${
                      unlocked(4) ? 'bg-gradient-to-r from-amber-500 to-emerald-400' : 'bg-slate-200'
                    }`}
                  />
                )}
                {!referenceImageReady && maxStage >= 5 && (
                  <div
                    className={`absolute left-1/2 bottom-[162px] h-6 w-24 -translate-x-1/2 rounded-[22px] ring-1 ring-slate-200 transition-all duration-500 ${
                      unlocked(5) ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-slate-200'
                    }`}
                  />
                )}

                {/* Ornamen puncak (stage 6) */}
                {!referenceImageReady && maxStage >= 6 && (
                  <div
                    className={`absolute left-1/2 bottom-[178px] -translate-x-1/2 transition-all duration-500 ${
                      unlocked(6) ? 'opacity-100' : 'opacity-35 grayscale'
                    }`}
                  >
                    <div className={`mx-auto h-4 w-14 rounded-2xl ring-1 ring-slate-200 ${unlocked(6) ? 'bg-amber-200' : 'bg-slate-200'}`} />
                    <div className="-mt-2 flex items-end justify-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`rounded-full ring-1 ring-slate-200 ${unlocked(6) ? 'bg-emerald-400' : 'bg-slate-300'}`}
                          style={{ width: 6 + i, height: 6 + i }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (focusMode) {
      return (
        <div className="fixed inset-0 z-[200] bg-slate-950/30 backdrop-blur-sm p-2 sm:p-4">
          <GameTutorialOverlay />
          <div className="mx-auto flex h-[100dvh] max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 sm:px-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-800">Mode Game PBL</div>
                <div className="truncate text-xs text-slate-500">{selectedProject.judul}</div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGameTutorial(true)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon name="help" className="h-4 w-4" />
                    Cara main
                  </span>
                </button>
                <button
                  type="button"
                  onClick={resetToProjectList}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Ganti Project
                </button>
                <button
                  type="button"
                  onClick={() => setFocusMode(false)}
                  className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
                >
                  Keluar
                </button>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-2 sm:p-4 lg:flex-row lg:overflow-hidden">
              <div className="flex shrink-0 flex-col gap-3 lg:w-[380px]">
                {progressData && groupProgression && (
                  <div className="rounded-xl bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-3 ring-1 ring-slate-200">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-black text-slate-800">Level Kelompok</div>
                        <div className="mt-0.5 text-xs text-slate-600">XP naik sesuai progres sintaks.</div>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-2 text-center shadow-sm ring-1 ring-slate-200">
                        <div className="text-[10px] font-semibold text-slate-500">LEVEL</div>
                        <div className="text-xl font-black text-amber-600">{groupProgression.level}</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">XP</span>
                        <span className="font-bold text-amber-700">{groupProgression.xp}/{groupProgression.nextLevelXp}</span>
                      </div>
                      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, (groupProgression.xp / groupProgression.nextLevelXp) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <TempleBoard variant="compact" />
                <QuestButtonsUI compact />
              </div>

              <div className="min-h-0 flex-1 overflow-visible rounded-xl bg-slate-50 p-2 sm:p-3 lg:overflow-y-auto">
                {progressData ? (
                  <>
                    <LeaderboardCard compact />
                    <GradeCard compact />
                    {activeStepSection}
                  </>
                ) : (
                  <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                    <div className="text-sm font-bold text-slate-800">Belum bisa masuk Mode Game</div>
                    <div className="mt-1 text-xs text-slate-600">
                      Kamu belum terdaftar di kelompok untuk project ini.
                    </div>
                    <button
                      type="button"
                      onClick={() => setFocusMode(false)}
                      className="mt-3 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600"
                    >
                      Kembali
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-6xl">
          <GameTutorialOverlay />
          {/* Header Project */}
          <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-3xl font-black text-slate-800">{selectedProject.judul}</h1>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGameTutorial(true)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon name="help" className="h-4 w-4" />
                    Cara main
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFocusMode(true)}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-600"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon name="gamepad" className="h-4 w-4" />
                    Mode Game
                  </span>
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div>
                <span className="font-semibold">Kelas:</span>{' '}
                {formatKelasLabel(selectedProject)}
              </div>
              <div>
                <span className="font-semibold">Deadline:</span>{' '}
                {new Date(selectedProject.deadline).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </div>
            </div>

            {/* Progress Bar */}
            {progressData && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">Progress Pengerjaan</span>
                  <span className="text-sm font-bold text-amber-600">
                    {progressData.completed_sintaks}/{progressData.total_sintaks} tahap ({progressData.completion_percentage}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressData.completion_percentage}%` }}
                  />
                </div>
                {progressData.completion_percentage === 100 && (
                  <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-emerald-600">
                    <Icon name="check" />
                    Semua tahapan sudah selesai! Menunggu evaluasi guru.
                  </p>
                )}
              </div>
            )}

            {progressData && <GradeCard />}

            {loadingProgress && (
              <div className="mt-4 text-sm text-slate-500">Memuat progress...</div>
            )}

            {!loadingProgress && !progressData && (
              <div className="mt-4 rounded-xl bg-amber-50 p-4 border border-amber-200">
                <p className="text-sm font-semibold text-amber-800">
                  <span className="inline-flex items-center gap-2">
                    <Icon name="alert" className="h-4 w-4" />
                    Anda belum terdaftar dalam kelompok
                  </span>
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Untuk mengerjakan project ini, Anda harus terdaftar dalam kelompok terlebih dahulu.
                  Silakan hubungi guru untuk dimasukkan ke dalam kelompok.
                </p>
              </div>
            )}
          </div>

          {/* Gamifikasi Kelompok: Level + XP */}
          {progressData && groupProgression && (
            <div className="mb-8 rounded-2xl bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5 sm:p-6 shadow-inner ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Icon name="group" className="h-4 w-4" />
                    Level Kelompok
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      +XP dari progres sintaks
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    XP dihitung otomatis dari: sintaks selesai, catatan, lampiran, dan bonus sebelum deadline.
                  </div>
                </div>

                <div className="shrink-0 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 text-center">
                  <div className="text-[11px] font-semibold text-slate-500">LEVEL</div>
                  <div className="text-2xl font-black text-amber-600">{groupProgression.level}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">XP</span>
                  <span className="font-bold text-amber-700">
                    {groupProgression.xp}/{groupProgression.nextLevelXp}
                  </span>
                </div>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, (groupProgression.xp / groupProgression.nextLevelXp) * 100))}%`,
                    }}
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                  <div className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-slate-200">
                    <span className="inline-flex items-center gap-2">
                      <Icon name="check" className="h-4 w-4" />
                      Sintaks selesai: <b className="text-slate-800">{progressData.completed_sintaks}</b>
                    </span>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-slate-200">
                    <span className="inline-flex items-center gap-2">
                      <Icon name="note" className="h-4 w-4" />
                      Catatan:{' '}
                      <b className="text-slate-800">
                        {(progressData.progress ?? []).filter((p) => (p.catatan ?? '').toString().trim().length > 0).length}
                      </b>
                    </span>
                  </div>
                  <div className="rounded-xl bg-white/70 px-3 py-2 ring-1 ring-slate-200">
                    <span className="inline-flex items-center gap-2">
                      <Icon name="paperclip" className="h-4 w-4" />
                      Lampiran: <b className="text-slate-800">{(progressData.progress ?? []).filter((p) => p.file_path != null).length}</b>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard (antar-kelompok) */}
          <LeaderboardCard />

          {progressData && buildingModel.total > 0 && (
            <div className="mb-8">
              <TempleBoard variant="wide" />
            </div>
          )}

          <QuestButtonsUI />

          {/* Achievement Badges (Gamifikasi) */}
          {progressData && (
            <AchievementBadges
              completedSintaks={progressData.completed_sintaks}
              totalSintaks={progressData.total_sintaks}
              completionPercentage={progressData.completion_percentage}
              deadline={selectedProject.deadline}
              progressItems={progressData.progress ?? []}
            />
          )}

          {/* Content Sintaks Aktif */}
          {activeStepSection}

          {/* Informasi Tambahan */}
          {selectedProject.referensi && (
            <div className="mt-8 rounded-2xl bg-white p-6 shadow-lg">
              <h3 className="mb-3 text-lg font-bold text-slate-800">Referensi</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedProject.referensi}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // List Projects View
  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <div className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
            PBL Siswa
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">Problem-Based Learning</h1>
          <p className="mt-2 text-sm text-slate-600">Pilih project PBL untuk dikerjakan</p>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-lg">
            <p className="text-slate-600">Belum ada project PBL yang tersedia untuk Anda.</p>
            <p className="mt-2 text-sm text-slate-500">Project akan muncul sesuai kelas dan jurusan Anda</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg transition hover:shadow-xl cursor-pointer"
                onClick={() => selectProject(project, { enterFocusMode: true })}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    void selectProject(project, { enterFocusMode: true })
                  }
                }}
              >
                <h3 className="text-xl font-bold text-slate-800">{project.judul}</h3>
                <p className="mt-3 text-sm text-slate-600 line-clamp-3">{project.masalah}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>Kelas {formatKelasLabel(project)}</span>
                  <span>
                    Deadline: {new Date(project.deadline).toLocaleDateString('id-ID')}
                  </span>
                </div>
                <button type="button" className="mt-4 w-full rounded-lg bg-amber-500 py-2 font-semibold text-white transition hover:bg-amber-600">
                  Kerjakan →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
