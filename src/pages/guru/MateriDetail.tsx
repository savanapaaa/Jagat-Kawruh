import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { materiAPI } from '../../lib/api'
import { Icon } from '../../components/ui/Icon'
import ResponsiveSelect from '../../components/ui/ResponsiveSelect'

type MateriStatus = 'Published' | 'Draft'

type MateriItem = {
  id: string
  judul: string
  pesan_pembelajaran?: string
  link_video?: string
  kelas: any
  kelas_ids?: Array<string | number>
  kelas_list?: Array<{ id?: string | number; nama?: string; tingkat?: string }>
  status: MateriStatus
  file_path?: string
  file_name?: string
  file_size?: number
  tugas_enabled?: any
}

type MateriSubmissionRow = {
  id: string
  nama_siswa?: string
  kelas_nama?: string
  file_name?: string
  submitted_at?: string
  created_at?: string
  nilai?: number | null
  feedback?: string | null
}

export default function MateriDetail() {
  const navigate = useNavigate()
  const { materiId } = useParams()
  const [materi, setMateri] = useState<MateriItem | null>(null)
  const [loading, setLoading] = useState(true)

  const [submissions, setSubmissions] = useState<MateriSubmissionRow[]>([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [submissionsError, setSubmissionsError] = useState<string | null>(null)
  const [savingBySubmissionId, setSavingBySubmissionId] = useState<Record<string, boolean | undefined>>({})
  const [nilaiBySubmissionId, setNilaiBySubmissionId] = useState<Record<string, string | undefined>>({})

  useEffect(() => {
    loadMateri()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materiId])

  async function loadMateri() {
    if (!materiId) {
      navigate('/guru/materi')
      return
    }

    try {
      const response = await materiAPI.getById(materiId)
      if (response.success && response.data) {
        setMateri(response.data)
        const tugasEnabled = isTugasEnabled((response.data as any)?.tugas_enabled)
        if (tugasEnabled) void loadSubmissions(materiId)
      } else {
        alert('Materi tidak ditemukan')
        navigate('/guru/materi')
      }
    } catch (error) {
      console.error('Error loading materi:', error)
      alert('Gagal memuat detail materi. Silakan coba lagi.')
      navigate('/guru/materi')
    } finally {
      setLoading(false)
    }
  }

  function isTugasEnabled(value: any): boolean {
    // Backward-compat: if backend doesn't send the flag yet, assume enabled.
    if (value == null) return true
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase()
      if (v === '0' || v === 'false' || v === 'no' || v === 'nonaktif' || v === 'inactive' || v === 'off') return false
      if (v === '1' || v === 'true' || v === 'yes' || v === 'aktif' || v === 'active' || v === 'on') return true
    }
    return true
  }

  async function handleTugasToggle(nextEnabled: boolean) {
    if (!materi) return
    try {
      const res = await materiAPI.update(materi.id, { tugas_enabled: nextEnabled })
      if (!res.success) {
        alert(res.message || 'Gagal mengubah pengaturan tugas')
        return
      }
      setMateri({ ...materi, tugas_enabled: nextEnabled })

      if (nextEnabled) {
        if (materiId) void loadSubmissions(materiId)
      } else {
        setSubmissions([])
        setSubmissionsError(null)
      }
      alert('Pengaturan tugas berhasil diubah!')
    } catch (error: any) {
      console.error('Error updating tugas_enabled:', error)
      alert(
        error?.message ||
          'Gagal mengubah pengaturan tugas. (Kalau muncul validasi 422, berarti backend belum menerima field tugas_enabled.)'
      )
    }
  }

  function extractArrayFromPayload(payload: any): any[] {
    if (Array.isArray(payload)) return payload

    const directKeys = ['data', 'items', 'submissions', 'results']
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

  function normalizeSubmissionRow(raw: any): MateriSubmissionRow | null {
    if (!raw || typeof raw !== 'object') return null
    const idRaw = (raw as any).id
    if (idRaw == null) return null

    const nilaiRaw = (raw as any).nilai
    const nilaiParsed =
      typeof nilaiRaw === 'number'
        ? nilaiRaw
        : typeof nilaiRaw === 'string' && nilaiRaw.trim().length > 0 && !Number.isNaN(Number(nilaiRaw))
          ? Number(nilaiRaw)
          : null

    return {
      id: String(idRaw),
      nama_siswa: typeof (raw as any).nama_siswa === 'string' ? (raw as any).nama_siswa : undefined,
      kelas_nama: typeof (raw as any).kelas_nama === 'string' ? (raw as any).kelas_nama : undefined,
      file_name: typeof (raw as any).file_name === 'string' ? (raw as any).file_name : undefined,
      submitted_at:
        typeof (raw as any).submitted_at === 'string'
          ? (raw as any).submitted_at
          : typeof (raw as any).created_at === 'string'
            ? (raw as any).created_at
            : undefined,
      created_at: typeof (raw as any).created_at === 'string' ? (raw as any).created_at : undefined,
      nilai: nilaiParsed,
      feedback: typeof (raw as any).feedback === 'string' ? (raw as any).feedback : null,
    }
  }

  async function loadSubmissions(id: string) {
    try {
      setSubmissionsError(null)
      setSubmissionsLoading(true)
      const res = await materiAPI.getSubmissions(id)
      if (!res.success) {
        setSubmissions([])
        setSubmissionsError(res.message || 'Gagal memuat pengumpulan tugas')
        return
      }

      const arr = extractArrayFromPayload(res.data)
      const normalized = arr.map(normalizeSubmissionRow).filter(Boolean) as MateriSubmissionRow[]
      setSubmissions(normalized)

      // Initialize grading inputs (do not clobber existing edits).
      setNilaiBySubmissionId((prev) => {
        const next = { ...prev }
        for (const s of normalized) {
          if (next[s.id] == null) next[s.id] = s.nilai == null ? '' : String(s.nilai)
        }
        return next
      })

    } catch (error: any) {
      console.error('Error loading submissions:', error)
      setSubmissions([])
      setSubmissionsError(error?.message || 'Gagal memuat pengumpulan tugas')
    } finally {
      setSubmissionsLoading(false)
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

  async function handleSaveNilai(submissionId: string) {
    const nilaiText = (nilaiBySubmissionId[submissionId] ?? '').trim()
    const nilai = Number(nilaiText)
    if (nilaiText.length === 0 || Number.isNaN(nilai)) {
      alert('Nilai harus diisi angka (0-100).')
      return
    }
    if (nilai < 0 || nilai > 100) {
      alert('Nilai harus di antara 0-100.')
      return
    }

    try {
      setSavingBySubmissionId((prev) => ({ ...prev, [submissionId]: true }))
      const res = await materiAPI.nilaiSubmission(submissionId, { nilai, feedback: '' })
      if (!res.success) {
        alert(res.message || 'Gagal menyimpan nilai. Silakan coba lagi.')
        return
      }
      alert('Nilai berhasil disimpan!')
      if (materiId) await loadSubmissions(materiId)
    } catch (error: any) {
      console.error('Error saving nilai:', error)
      alert(error?.message || 'Gagal menyimpan nilai. Silakan coba lagi.')
    } finally {
      setSavingBySubmissionId((prev) => ({ ...prev, [submissionId]: false }))
    }
  }

  async function handleStatusChange(newStatus: MateriStatus) {
    if (!materi) return
    
    try {
      const response = await materiAPI.update(materi.id, { status: newStatus })
      if (response.success) {
        setMateri({ ...materi, status: newStatus })
        alert('Status materi berhasil diubah!')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Gagal mengubah status materi. Silakan coba lagi.')
    }
  }

  async function handleDownload() {
    if (!materi) return
    
    try {
      await materiAPI.download(materi.id)
    } catch (error) {
      console.error('Error downloading file:', error)
      alert(error instanceof Error ? error.message : 'Gagal mengunduh file')
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat detail materi...</p>
      </div>
    )
  }

  if (!materi) return null

  const kelasDisplay =
    (Array.isArray(materi.kelas_list) && materi.kelas_list.length > 0
      ? materi.kelas_list
          .map((k) => (typeof k?.nama === 'string' ? k.nama : String(k?.id ?? '')))
          .filter(Boolean)
          .join(', ')
      : Array.isArray(materi.kelas_ids) && materi.kelas_ids.length > 0
        ? materi.kelas_ids.map((v) => String(v)).join(', ')
        : Array.isArray(materi.kelas)
          ? materi.kelas.join(', ')
          : typeof materi.kelas === 'string'
            ? materi.kelas
            : String(materi.kelas?.nama ?? materi.kelas?.tingkat ?? '-'))

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
      {/* Header dengan tombol kembali */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/guru/materi')}
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="text-xs font-semibold tracking-wide text-slate-500">DETAIL MATERI</div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-800">{materi.judul}</h1>
        </div>
        <div
          className={
            'shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ' +
            (materi.status === 'Published'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-200 text-slate-700')
          }
        >
          {materi.status}
        </div>
      </div>

      {materi.pesan_pembelajaran && (
        <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <div className="text-xs font-semibold text-sky-700">Info/Tata Cara Pembelajaran</div>
          <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{materi.pesan_pembelajaran}</div>
        </div>
      )}

      {/* Info Materi */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">Kelas</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-800">{kelasDisplay}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">Status</div>
          <div className="mt-1">
            <ResponsiveSelect
              value={materi.status}
              onChange={(value) => handleStatusChange(value as MateriStatus)}
              placeholder="Pilih Status"
              includeEmptyOption={false}
              buttonClassName="rounded-lg px-3 py-2 font-semibold focus:border-emerald-400"
              options={[
                { value: 'Draft', label: 'Draf' },
                { value: 'Published', label: 'Dipublikasikan' },
              ]}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold text-slate-500">File/Link Materi</div>
          <div className="mt-2 text-sm font-semibold text-slate-800">
            {materi.file_name ? (
              <span className="inline-flex items-center gap-2 text-emerald-600">
                <Icon name="check" />
                {materi.file_name}
              </span>
            ) : (
              <span className="text-slate-400">Tidak ada file</span>
            )}
          </div>

          {materi.link_video && (
            <div className="mt-2">
              <a
                href={String(materi.link_video)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-200"
              >
                Buka Video
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-semibold text-slate-500">Pengumpulan Tugas</div>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-800">
            {isTugasEnabled(materi.tugas_enabled) ? 'Aktif' : 'Nonaktif'}
          </div>
            <div className="w-full sm:w-40">
              <ResponsiveSelect
                value={isTugasEnabled(materi.tugas_enabled) ? 'aktif' : 'nonaktif'}
                onChange={(value) => handleTugasToggle(value === 'aktif')}
                placeholder="Pilih Status"
                includeEmptyOption={false}
                buttonClassName="rounded-lg px-3 py-2 font-semibold focus:border-emerald-400"
                options={[
                  { value: 'aktif', label: 'Aktif' },
                  { value: 'nonaktif', label: 'Nonaktif' },
                ]}
              />
            </div>
        </div>
        <div className="mt-1 text-xs text-slate-600">Kalau Nonaktif, siswa tidak bisa mengumpulkan tugas untuk materi ini.</div>
      </div>

      {/* File Download/View */}
      {materi.file_name && (
        <div className="mt-6">
          <div className="mb-3 text-lg font-extrabold text-slate-800">File Materi</div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <svg className="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800">{materi.file_name}</div>
                <div className="text-xs text-slate-500">
                  {materi.file_size ? `${Math.ceil(materi.file_size / 1024)} KB` : 'File tersimpan'}
                </div>
              </div>
              <button
                onClick={handleDownload}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Lihat PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {isTugasEnabled(materi.tugas_enabled) ? (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-lg font-extrabold text-slate-800">Pengumpulan Tugas</div>
            <button
              type="button"
              onClick={() => materiId && loadSubmissions(materiId)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Muat ulang
            </button>
          </div>

          {submissionsError && (
            <div className="mb-4 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200">
              <div className="text-sm text-rose-700">{submissionsError}</div>
            </div>
          )}

          {submissionsLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Memuat pengumpulan...</div>
          ) : submissions.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Belum ada siswa yang mengumpulkan.</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Siswa</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Kelas</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">File</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Waktu</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Nilai</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {submissions.map((s) => (
                    <tr key={s.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{s.nama_siswa || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{s.kelas_nama || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800">{s.file_name || '-'}</div>
                        <button
                          type="button"
                          onClick={() => handleDownloadSubmission(s.id)}
                          className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Unduh
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{s.submitted_at || s.created_at || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="grid gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={nilaiBySubmissionId[s.id] ?? ''}
                            onChange={(e) => setNilaiBySubmissionId((prev) => ({ ...prev, [s.id]: e.target.value }))}
                            placeholder="0-100"
                            className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={!!savingBySubmissionId[s.id]}
                          onClick={() => handleSaveNilai(s.id)}
                          className={
                            'rounded-lg px-3 py-2 text-sm font-semibold text-white ' +
                            (savingBySubmissionId[s.id] ? 'cursor-not-allowed bg-slate-300' : 'bg-amber-500 hover:bg-amber-600')
                          }
                        >
                          {savingBySubmissionId[s.id] ? 'Menyimpan...' : 'Simpan'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Pengumpulan tugas dimatikan untuk materi ini.
        </div>
      )}
    </div>
  )
}
