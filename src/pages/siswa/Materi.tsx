import { useEffect, useMemo, useState } from 'react'
import { getSession } from '../../lib/auth'
import { authAPI, kelasAPI, materiAPI, siswaAPI } from '../../lib/api'
import { tambahNotifikasi } from '../../lib/idbNotifikasi'

type TeacherMateriStatus = 'Aktif' | 'Dipublikasikan' | 'Draft' | string

type MateriKelasInfo = {
  id?: string | number
  nama?: string
  tingkat?: string
}

type TeacherMateriItem = {
  id: string
  judul: string
  pesan_pembelajaran?: string
  link_video?: string
  // Backend may return legacy `kelas` and new many-to-many fields (`kelas_ids`, `kelas_list`).
  kelas: any
  kelas_ids?: Array<string | number>
  kelas_list?: MateriKelasInfo[]
  status: TeacherMateriStatus
  file_path?: string
  file_name?: string
  file_size?: number
  tugas_enabled?: any
}

type MateriSubmission = {
  id: string
  file_name?: string
  file_url?: string
  catatan?: string | null
  nilai?: number | null
  feedback?: string | null
  submitted_at?: string
  created_at?: string
  updated_at?: string
}

type KelasCatalogItem = {
  id: string
  nama: string
  tingkat?: string
}


function extractArrayFromPayload(payload: any): any[] {
  if (Array.isArray(payload)) return payload

  const directKeys = ['data', 'items', 'materi', 'results']
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

  // Common pagination shape: { data: { data: [] } }
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
        if (k.id != null) out.push(String(k.id).trim())
        if (typeof k.nama === 'string') out.push(k.nama.trim())
        if (typeof k.tingkat === 'string') out.push(k.tingkat.trim())
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

    // Backend might return JSON string, e.g. "[\"1\",\"2\"]" or "[\"X\"]"
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const parsed = JSON.parse(s)
        if (Array.isArray(parsed)) {
          return parsed.map((k) => String(k).trim()).filter(Boolean)
        }
      } catch {
        // ignore
      }
    }

    // Backend might return comma separated string, e.g. "X, XI"
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
    if (raw.id != null) out.push(String(raw.id).trim())
    if (typeof raw.nama === 'string') out.push(raw.nama.trim())
    if (typeof raw.tingkat === 'string') out.push(raw.tingkat.trim())
    return out.filter(Boolean)
  }
  return []
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

function isPublishedStatus(status: any): boolean {
  const s = String(status ?? '').trim().toLowerCase()
  return s === 'published' || s === 'dipublikasikan' || s === 'aktif'
}

function formatKelasLabel(item: TeacherMateriItem): string {
  if (Array.isArray(item.kelas_list) && item.kelas_list.length > 0) {
    const names = item.kelas_list
      .map((k) => (typeof k?.nama === 'string' ? k.nama.trim() : ''))
      .filter(Boolean)
    if (names.length) return names.join(', ')
  }

  const raw = item.kelas_ids ?? item.kelas
  if (Array.isArray(raw)) return raw.map((v) => String(v)).join(', ')
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') return String(raw.nama ?? raw.tingkat ?? '-')
  return '-'
}

function isTugasEnabled(value: any): boolean {
  if (value == null) return true
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === '0' || v === 'false' || v === 'no' || v === 'nonaktif' || v === 'inactive' || v === 'off') return false
    if (v === '1' || v === 'true' || v === 'yes' || v === 'aktif' || v === 'active' || v === 'on') return true
  }
  // Unknown types/values: assume enabled to avoid breaking older backends.
  return true
}

function isPdfMaterial(item: TeacherMateriItem): boolean {
  const name = String(item.file_name ?? '').trim().toLowerCase()
  const path = String(item.file_path ?? '').trim().toLowerCase()
  return name.endsWith('.pdf') || path.endsWith('.pdf')
}

export default function Materi() {
  const session = getSession()
  const [items, setItems] = useState<TeacherMateriItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kelasLabel, setKelasLabel] = useState<string>('')

  const [submissionByMateriId, setSubmissionByMateriId] = useState<Record<string, MateriSubmission | null | undefined>>({})
  const [submissionLoadingByMateriId, setSubmissionLoadingByMateriId] = useState<Record<string, boolean | undefined>>({})
  const [fileByMateriId, setFileByMateriId] = useState<Record<string, File | null | undefined>>({})
  const [catatanByMateriId, setCatatanByMateriId] = useState<Record<string, string | undefined>>({})
  const [submittingByMateriId, setSubmittingByMateriId] = useState<Record<string, boolean | undefined>>({})
  const [previewUrlByMateriId, setPreviewUrlByMateriId] = useState<Record<string, string | undefined>>({})
  const [previewLoadingByMateriId, setPreviewLoadingByMateriId] = useState<Record<string, boolean | undefined>>({})
  const [previewErrorByMateriId, setPreviewErrorByMateriId] = useState<Record<string, string | undefined>>({})

  useEffect(() => {
    loadMateri()
  }, [])

  useEffect(() => {
    let cancelled = false
    const createdUrls: string[] = []

    async function loadPreviews() {
      const targets = items
        .filter((m) => isPublishedStatus(m.status))
        .filter((m) => isPdfMaterial(m) && (m.file_path || m.file_name))
      if (targets.length === 0) return

      await Promise.allSettled(
        targets.map(async (m) => {
          if (previewUrlByMateriId[m.id]) return

          try {
            setPreviewLoadingByMateriId((prev) => ({ ...prev, [m.id]: true }))
            setPreviewErrorByMateriId((prev) => ({ ...prev, [m.id]: undefined }))

            const { blob } = await materiAPI.fetchBlob(m.id)
            const url = URL.createObjectURL(blob)
            createdUrls.push(url)

            if (cancelled) {
              URL.revokeObjectURL(url)
              return
            }

            setPreviewUrlByMateriId((prev) => ({ ...prev, [m.id]: url }))
          } catch (error) {
            if (cancelled) return
            const message = error instanceof Error ? error.message : 'Preview materi belum bisa ditampilkan.'
            setPreviewErrorByMateriId((prev) => ({ ...prev, [m.id]: message }))
          } finally {
            if (!cancelled) {
              setPreviewLoadingByMateriId((prev) => ({ ...prev, [m.id]: false }))
            }
          }
        })
      )
    }

    void loadPreviews()

    return () => {
      cancelled = true
      for (const url of createdUrls) {
        URL.revokeObjectURL(url)
      }
    }
    // Only react to material list changes; we intentionally skip dynamic map dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  async function loadMateri() {
    try {
      setError(null)
      // NOTE: Do not server-filter by kelas/status here.
      // Backend implementations vary: status can be "Aktif" or "Dipublikasikan",
      // and kelas can be stored as tingkat/name/id/array.
      // We'll fetch materi then filter client-side.

      // 1) Get the most reliable siswa kelas info.
      const session = getSession()
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
        // ignore: fallback to session
      }

      // Fallback to /siswa/me (backend now supports this for siswa).
      // This avoids calling restricted /siswa/{id} while still getting full kelas info.
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

      // 2) Load kelas catalog to map IDs <-> names/tingkat.
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
        // ignore: mapping will fall back to whatever backend provides
      }

      // If we have kelas_id but not a good display name, try to fill it from catalog.
      if (siswaKelasId && (!siswaKelasNama || isTingkatOnly(siswaKelasNama)) && kelasCatalog.length > 0) {
        const found = kelasCatalog.find((k) => String(k.id) === siswaKelasId)
        if (found?.nama) siswaKelasNama = found.nama
        if (found?.tingkat) siswaKelasTingkat = found.tingkat
        if (!siswaKelasTingkat && found?.nama) siswaKelasTingkat = extractTingkatFromKelasName(found.nama)
      }

      // Update header label from the best resolved value (not only session storage).
      setKelasLabel(siswaKelasNama || siswaKelasTingkat || '')

      // 3) Fetch materi.
      const response = await materiAPI.getAll()

      if (!response.success) {
        setError(response.message || 'Gagal memuat materi')
        setItems([])
        return
      }

      const payload: any = response.data
      const dataArray: any[] = extractArrayFromPayload(payload)

      const cleaned = dataArray
        .filter(Boolean)
        .map((m: any) => ({
          id: String(m.id),
          judul: String(m.judul ?? ''),
          pesan_pembelajaran:
            typeof m.pesan_pembelajaran === 'string'
              ? m.pesan_pembelajaran
              : typeof m.pesan === 'string'
                ? m.pesan
                : typeof m.instruksi_pembelajaran === 'string'
                  ? m.instruksi_pembelajaran
                  : undefined,
          link_video:
            typeof m.link_video === 'string'
              ? m.link_video
              : typeof m.video_url === 'string'
                ? m.video_url
                : undefined,
          kelas: m.kelas,
          kelas_ids: Array.isArray(m.kelas_ids) ? m.kelas_ids : undefined,
          kelas_list: Array.isArray(m.kelas_list) ? m.kelas_list : undefined,
          status: m.status as TeacherMateriStatus,
          file_path: m.file_path,
          file_name: m.file_name,
          file_size: typeof m.file_size === 'number' ? m.file_size : undefined,
          tugas_enabled: (m as any).tugas_enabled,
        }))

      const siswaHasSpecificClass = !!siswaKelasId || (!!siswaKelasNama && !isTingkatOnly(siswaKelasNama))

      const filteredByKelas = cleaned.filter((m) => {
        if (!siswaKelasId && !siswaKelasNama && !siswaKelasTingkat) return true

        const kelasSource =
          (Array.isArray(m.kelas_ids) && m.kelas_ids.length > 0 ? m.kelas_ids : null) ||
          (Array.isArray(m.kelas_list) && m.kelas_list.length > 0 ? m.kelas_list : null) ||
          m.kelas

        const rawTokens = normalizeKelasValues(kelasSource)
        if (rawTokens.length === 0) return false

        // Expand materi tokens using catalog: if tokens are IDs, also add their names/tingkat.
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

        // Strict matching preference:
        // 1) kelas_id exact match (most accurate)
        if (idNeedle && tokens.includes(idNeedle)) return true

        // 2) full kelas name exact match (e.g. "X RPL 1")
        if (namaNeedle && tokens.includes(namaNeedle)) return true

        // 3) fallback tingkat match ONLY if siswa doesn't have a specific class.
        // This supports older materi tagged by tingkat (X/XI/XII).
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

      // Only show published-like items for siswa.
      const visible = filteredByKelas.filter((m) => isPublishedStatus(m.status))
      setItems(visible)

      // Load tugas submission status for each materi (best-effort).
      void loadAllSubmissionStatuses(visible.map((m) => m.id))

      // Reconcile `tugas_enabled` from detail endpoint to avoid stale/missing flags in list payload.
      void reconcileTugasEnabledFlags(visible)
    } catch (error: any) {
      if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        setItems([])
        setError('Tidak memiliki akses untuk melihat materi. Hubungi administrator.')
      } else {
        setError('Terjadi kesalahan saat memuat materi')
      }
    } finally {
      setLoading(false)
    }
  }

  async function reconcileTugasEnabledFlags(materials: TeacherMateriItem[]) {
    const idsToVerify = materials
      .filter((m) => m?.id)
      .filter((m) => m.tugas_enabled == null || !isTugasEnabled(m.tugas_enabled))
      .map((m) => m.id)

    if (idsToVerify.length === 0) return

    await Promise.allSettled(
      idsToVerify.map(async (materiId) => {
        try {
          const res = await materiAPI.getById(materiId)
          if (!res.success || !res.data) return
          const flag = (res.data as any).tugas_enabled
          setItems((prev) => prev.map((it) => (it.id === materiId ? { ...it, tugas_enabled: flag } : it)))
        } catch {
          // ignore: keep current value
        }
      })
    )
  }

  function normalizeSubmissionPayload(raw: any): MateriSubmission | null {
    const candidate = raw?.submission ?? raw?.data ?? raw
    if (!candidate || typeof candidate !== 'object') return null
    const idRaw = (candidate as any).id
    if (idRaw == null) return null

    const nilaiRaw = (candidate as any).nilai
    const nilaiParsed =
      typeof nilaiRaw === 'number'
        ? nilaiRaw
        : typeof nilaiRaw === 'string' && nilaiRaw.trim().length > 0 && !Number.isNaN(Number(nilaiRaw))
          ? Number(nilaiRaw)
          : null

    return {
      id: String(idRaw),
      file_name: typeof (candidate as any).file_name === 'string' ? (candidate as any).file_name : undefined,
      file_url: typeof (candidate as any).file_url === 'string' ? (candidate as any).file_url : undefined,
      catatan: typeof (candidate as any).catatan === 'string' ? (candidate as any).catatan : null,
      nilai: nilaiParsed,
      feedback: typeof (candidate as any).feedback === 'string' ? (candidate as any).feedback : null,
      submitted_at:
        typeof (candidate as any).submitted_at === 'string'
          ? (candidate as any).submitted_at
          : typeof (candidate as any).created_at === 'string'
            ? (candidate as any).created_at
            : undefined,
      created_at: typeof (candidate as any).created_at === 'string' ? (candidate as any).created_at : undefined,
      updated_at: typeof (candidate as any).updated_at === 'string' ? (candidate as any).updated_at : undefined,
    }
  }

  async function loadAllSubmissionStatuses(materiIds: string[]) {
    await Promise.allSettled(materiIds.map((id) => loadSubmissionStatus(id)))
  }

  async function loadSubmissionStatus(materiId: string) {
    try {
      setSubmissionLoadingByMateriId((prev) => ({ ...prev, [materiId]: true }))
      const res = await materiAPI.getMySubmission(materiId)
      if (res.success) {
        const submission = normalizeSubmissionPayload(res.data)
        setSubmissionByMateriId((prev) => ({ ...prev, [materiId]: submission }))
      } else {
        setSubmissionByMateriId((prev) => ({ ...prev, [materiId]: null }))
      }
    } catch {
      // Best-effort: keep UI usable even if endpoint not available.
      setSubmissionByMateriId((prev) => ({ ...prev, [materiId]: null }))
    } finally {
      setSubmissionLoadingByMateriId((prev) => ({ ...prev, [materiId]: false }))
    }
  }

  async function handleSubmitTugas(materiId: string) {
    const file = fileByMateriId[materiId]
    if (!file) return

    try {
      setSubmittingByMateriId((prev) => ({ ...prev, [materiId]: true }))
      const catatan = catatanByMateriId[materiId]
      const res = await materiAPI.submitTugas(materiId, { file, catatan })
      if (!res.success) {
        alert(res.message || 'Gagal mengumpulkan tugas')
        return
      }

      alert('Tugas berhasil dikumpulkan!')

      try {
        const email = session?.email ? String(session.email).trim() : ''
        if (email) {
          const materiJudul = items.find((m) => m.id === materiId)?.judul?.trim() || 'Materi'
          await tambahNotifikasi({
            judul: 'Tugas berhasil dikumpulkan',
            pesan: `Tugas untuk "${materiJudul}" sudah terkirim.`,
            tipe: 'materi',
            targetSiswa: email,
          })
          window.dispatchEvent(new CustomEvent('notifikasi:changed'))
        }
      } catch {
        // ignore: notification is best-effort
      }

      setFileByMateriId((prev) => ({ ...prev, [materiId]: null }))
      await loadSubmissionStatus(materiId)
    } catch (error: any) {
      console.error('Error submit tugas:', error)
      alert(error?.message || 'Gagal mengumpulkan tugas')
    } finally {
      setSubmittingByMateriId((prev) => ({ ...prev, [materiId]: false }))
    }
  }

  async function handleDownloadSubmission(submissionId: string) {
    try {
      await materiAPI.downloadSubmission(submissionId)
    } catch (error) {
      console.error('Error downloading submission:', error)
      alert(error instanceof Error ? error.message : 'Gagal mengunduh file')
    }
  }

  const published = useMemo(() => items.filter((m) => isPublishedStatus(m.status)), [items])

  async function handleDownload(id: string) {
    try {
      await materiAPI.download(id)
    } catch (error) {
      console.error('Error downloading materi:', error)
      alert(error instanceof Error ? error.message : 'Gagal mengunduh file')
    }
  }

  async function handleOpen(id: string) {
    try {
      await materiAPI.open(id)
    } catch (error) {
      console.error('Error opening materi:', error)
      alert(error instanceof Error ? error.message : 'Gagal membuka file')
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat materi...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
          Materi Siswa
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">Materi</h1>
        <p className="mt-2 text-sm text-slate-600">Daftar materi dari guru (PDF/dokumen/file).</p>
        {(kelasLabel || session?.kelas) && (
          <div className="mt-1 text-xs text-slate-500">Kelas: {kelasLabel || session?.kelas}</div>
        )}
      </div>

      {error && (
        <div className="rounded-3xl bg-rose-50 p-6 shadow-sm ring-1 ring-rose-200">
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      <div className="grid gap-4">
        {published.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            {error ? 'Tidak ada materi yang dapat ditampilkan' : 'Belum ada materi yang dipublikasikan oleh guru.'}
          </div>
        ) : (
          published.map((m) => (
            <div key={m.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500">
                    Kelas {formatKelasLabel(m)}
                  </div>
                  <div className="mt-1 text-lg font-extrabold text-slate-800">{m.judul}</div>
                  {m.pesan_pembelajaran && (
                    <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-3">
                      <p className="text-xs font-semibold text-sky-700">Info/Tata Cara Pembelajaran</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{m.pesan_pembelajaran}</p>
                    </div>
                  )}
                  <div className="mt-2 text-xs text-slate-500">
                    {m.file_name ? (
                      <span>
                        {m.file_name}
                        {m.file_size ? <span className="text-slate-400"> • {Math.ceil(m.file_size / 1024)} KB</span> : null}
                      </span>
                    ) : m.link_video ? (
                      <span>Link video tersedia</span>
                    ) : (
                      <span className="text-slate-400">Materi belum tersedia</span>
                    )}
                  </div>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Dipublikasikan</span>
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!(m.file_path || m.file_name)}
                    className={
                      'rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ' +
                      (m.file_path || m.file_name
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'cursor-not-allowed bg-slate-200 text-slate-500')
                    }
                    onClick={() => handleOpen(m.id)}
                  >
                    {isPdfMaterial(m) ? 'Buka PDF' : 'Buka File'}
                  </button>
                  {m.link_video && (
                    <a
                      href={String(m.link_video)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      Buka Video
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={!(m.file_path || m.file_name)}
                    className={
                      'rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm ' +
                      (m.file_path || m.file_name
                        ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400')
                    }
                    onClick={() => handleDownload(m.id)}
                  >
                    Unduh
                  </button>
                </div>
              </div>

              {isPdfMaterial(m) && (m.file_path || m.file_name) && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
                    <div className="text-xs font-semibold text-slate-700">Preview Materi</div>
                    <div className="text-[11px] text-slate-500">Ditampilkan langsung di halaman</div>
                  </div>

                  {previewLoadingByMateriId[m.id] ? (
                    <div className="flex h-80 items-center justify-center text-sm text-slate-500">Memuat preview PDF...</div>
                  ) : previewUrlByMateriId[m.id] ? (
                    <iframe
                      src={previewUrlByMateriId[m.id]}
                      title={`Preview materi ${m.judul}`}
                      className="h-[420px] w-full bg-white sm:h-[560px]"
                    />
                  ) : (
                    <div className="p-4 text-sm text-slate-600">
                      {previewErrorByMateriId[m.id] || 'Preview belum tersedia. Silakan gunakan tombol Buka PDF atau Unduh.'}
                    </div>
                  )}
                </div>
              )}

                  {!isPdfMaterial(m) && (m.file_path || m.file_name) && (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      File selain PDF belum bisa dipreview di halaman. Gunakan tombol <span className="font-semibold">Buka File</span> atau <span className="font-semibold">Unduh</span>.
                    </div>
                  )}

              {isTugasEnabled(m.tugas_enabled) && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-extrabold text-slate-800">Tugas Materi</div>
                  <div className="mt-1 text-xs text-slate-600">Kumpulkan file tugas untuk materi ini.</div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {submissionLoadingByMateriId[m.id] ? (
                      <span className="rounded-full bg-slate-200 px-3 py-1 font-semibold text-slate-700">Memuat status...</span>
                    ) : submissionByMateriId[m.id] ? (
                      <>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">Sudah mengumpulkan</span>
                        <span className="text-slate-500">
                          {submissionByMateriId[m.id]?.submitted_at ? `• ${submissionByMateriId[m.id]?.submitted_at}` : null}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDownloadSubmission(submissionByMateriId[m.id]!.id)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Unduh file kamu
                        </button>
                      </>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">Belum mengumpulkan</span>
                    )}
                  </div>

                  {submissionByMateriId[m.id] && (
                    <div className="mt-2 text-xs text-slate-600">
                      Tugas kamu sudah berhasil disimpan di sistem.
                    </div>
                  )}

                  <div className="mt-4 grid gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-700">File tugas</div>
                      <input
                        type="file"
                        accept=".pdf,.zip,.rar,.docx,.pptx,.xlsx,.doc,.ppt,.xls"
                        className="mt-1 block w-full md:w-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) setFileByMateriId((prev) => ({ ...prev, [m.id]: file }))
                        }}
                      />
                      <div className="mt-1 text-[10px] text-slate-500">Maks 20MB. Format: pdf/zip/rar/docx/pptx/xlsx.</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={!fileByMateriId[m.id] || submittingByMateriId[m.id]}
                      onClick={() => handleSubmitTugas(m.id)}
                      className={
                        'rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ' +
                        (!fileByMateriId[m.id] || submittingByMateriId[m.id]
                          ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                          : 'bg-amber-500 text-white hover:bg-amber-600')
                      }
                    >
                      {submittingByMateriId[m.id]
                        ? 'Mengirim...'
                        : submissionByMateriId[m.id]
                          ? 'Kirim Ulang'
                          : 'Kumpulkan'}
                    </button>
                    <div className="text-xs text-slate-500">Kirim ulang akan mengganti file dan reset penilaian.</div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
