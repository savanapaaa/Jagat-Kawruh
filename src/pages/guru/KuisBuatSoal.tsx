import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatApiErrorAlert, kuisAPI } from '../../lib/api'
import { Icon } from '../../components/ui/Icon'
import ResponsiveSelect from '../../components/ui/ResponsiveSelect'

type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E'
type ChoiceOptions = Record<ChoiceKey, string>
type KuisStatus = 'Aktif' | 'Draft' | 'Selesai'

type Question = {
  id: string
  text: string
  image?: string
  options: ChoiceOptions
  answer: ChoiceKey
}

const DEFAULT_OPTIONS: ChoiceOptions = { A: '', B: '', C: '', D: '', E: '' }

function isChoiceKey(v: unknown): v is ChoiceKey {
  return v === 'A' || v === 'B' || v === 'C' || v === 'D' || v === 'E'
}

function createDraftQuestion(): Question {
  return {
    id: `q-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: '',
    options: { ...DEFAULT_OPTIONS },
    answer: 'A',
  }
}

export default function KuisBuatSoal() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as
    | { title: string; kelas: string; status: KuisStatus; numQuestions: number; batasWaktu?: number }
    | { draftKuisId: string; expectedCount?: number }
    | null

  // Redirect jika tidak ada state
  if (!state) {
    navigate('/guru/kuis')
    return null
  }

  const isEditDraft = !!(state && typeof state === 'object' && 'draftKuisId' in state && state.draftKuisId)
  const draftKuisId = isEditDraft ? String((state as any).draftKuisId) : null

  const [title, setTitle] = useState(() => (!isEditDraft ? String((state as any)?.title ?? '') : ''))
  const [kelas, setKelas] = useState(() => (!isEditDraft ? String((state as any)?.kelas ?? '') : ''))
  const [status, setStatus] = useState<KuisStatus>(() => (!isEditDraft ? ((state as any)?.status as KuisStatus) : 'Draft'))
  const [numQuestions, setNumQuestions] = useState(() => (!isEditDraft ? Number((state as any)?.numQuestions ?? 0) : 0))
  const [safeBatasWaktu, setSafeBatasWaktu] = useState(() => {
    if (isEditDraft) return 30
    const bw = Number((state as any)?.batasWaktu)
    return Number.isFinite(bw) && bw > 0 ? Math.floor(bw) : 30
  })

  const [saving, setSaving] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState<boolean>(isEditDraft)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [draftQuestions, setDraftQuestions] = useState<Question[]>(() => {
    if (isEditDraft) return []
    const n = Math.max(1, Number((state as any)?.numQuestions ?? 1))
    return Array.from({ length: n }, () => createDraftQuestion())
  })

  useEffect(() => {
    if (!isEditDraft || !draftKuisId) return
    let cancelled = false

    const tryParseJson = (value: any) => {
      if (typeof value !== 'string') return value
      const s = value.trim()
      if (!s) return value
      if (!(s.startsWith('{') || s.startsWith('['))) return value
      try {
        return JSON.parse(s)
      } catch {
        return value
      }
    }

    const pickString = (...values: any[]) => {
      for (const v of values) {
        if (typeof v === 'string' && v.trim().length > 0) return v
      }
      return ''
    }

    const coerceChoiceOptions = (raw: any): ChoiceOptions => {
      const parsed = tryParseJson(raw)

      // Array: assume [A,B,C,D,E]
      if (Array.isArray(parsed)) {
        const arr = parsed.map((x) => String(x ?? ''))
        return {
          A: String(arr[0] ?? ''),
          B: String(arr[1] ?? ''),
          C: String(arr[2] ?? ''),
          D: String(arr[3] ?? ''),
          E: String(arr[4] ?? ''),
        }
      }

      // Object: accept uppercase/lowercase keys
      const obj = parsed && typeof parsed === 'object' ? parsed : {}
      const get = (k: string) => String((obj as any)[k] ?? (obj as any)[k.toLowerCase()] ?? '')
      return { A: get('A'), B: get('B'), C: get('C'), D: get('D'), E: get('E') }
    }

    const coerceQuestion = (q: any): Question => {
      const raw = tryParseJson(q)
      const id = String((raw as any)?.id ?? `q-${Date.now()}-${Math.random().toString(16).slice(2)}`)
      const text = pickString(
        (raw as any)?.text,
        (raw as any)?.pertanyaan,
        (raw as any)?.question,
        (raw as any)?.prompt
      )
      const optionsRaw = (raw as any)?.options ?? (raw as any)?.pilihan ?? (raw as any)?.choices
      const options = coerceChoiceOptions(optionsRaw)

      const answerRaw = (raw as any)?.answer ?? (raw as any)?.jawaban ?? (raw as any)?.correct ?? (raw as any)?.kunci
      const answerStr = typeof answerRaw === 'string' ? answerRaw.trim().toUpperCase() : answerRaw
      const answer: ChoiceKey = isChoiceKey(answerStr) ? answerStr : 'A'

      const image = typeof (raw as any)?.image === 'string' ? (raw as any).image : undefined
      return { id, text, image, options, answer }
    }

    async function load() {
      setLoadingDraft(true)
      try {
        const res = await kuisAPI.getById(String(draftKuisId))
        const data = (res as any)?.data
        if (!res?.success || !data) {
          throw new Error('Draft kuis tidak ditemukan')
        }

        const pickNumber = (value: any): number | undefined => {
          const n = Number(value)
          return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined
        }

        const bw = Number(data?.batas_waktu ?? data?.batasWaktu)
        const soalRaw = Array.isArray(data?.soal)
          ? data.soal
          : Array.isArray(data?.questions)
            ? data.questions
            : []
        const qs = soalRaw.map(coerceQuestion)

        const targetCount =
          pickNumber(data?.total_soal ?? data?.total_questions ?? data?.jumlah_soal) ??
          pickNumber((data as any)?.draft_soal_count) ??
          pickNumber(data?.totalSoal ?? data?.totalQuestions ?? data?.jumlahSoal) ??
          pickNumber((data as any)?.soal_count ?? (data as any)?.question_count ?? (data as any)?.questions_count) ??
          pickNumber((data?.meta as any)?.total_soal ?? (data?.meta as any)?.jumlah_soal) ??
          pickNumber((data?.meta as any)?.totalSoal ?? (data?.meta as any)?.jumlahSoal) ??
          pickNumber((data?.meta as any)?.draft_soal_count) ??
          pickNumber((state as any)?.expectedCount) ??
          undefined

        const n = Math.max(targetCount ?? 0, qs.length || 0, 1)

        const paddedQuestions = (() => {
          if (qs.length >= n) return qs
          const extra = Array.from({ length: n - qs.length }, () => createDraftQuestion())
          return [...qs, ...extra]
        })()

        if (!cancelled) {
          setTitle(String(data?.judul ?? ''))
          // Prefer kelas_ids first; fallback to legacy kelas.
          const kelasId = Array.isArray(data?.kelas_ids) && data.kelas_ids.length > 0 ? data.kelas_ids[0] : data?.kelas
          setKelas(String(kelasId ?? ''))
          setStatus((data?.status as KuisStatus) || 'Draft')
          setSafeBatasWaktu(Number.isFinite(bw) && bw > 0 ? Math.floor(bw) : 30)
          setNumQuestions(n)
          setDraftQuestions(paddedQuestions)
        }
      } catch (error) {
        console.error('Gagal memuat draft kuis:', error)
        alert(formatApiErrorAlert('Gagal memuat draft kuis.', error))
        navigate('/guru/kuis')
      } finally {
        if (!cancelled) setLoadingDraft(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [draftKuisId, isEditDraft, navigate])

  function isAllowedImportFile(file: File): boolean {
    const name = file.name.toLowerCase()
    return name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')
  }

  async function handleImportSoal() {
    if (!draftKuisId) {
      alert('Simpan draft kuis dulu sebelum import soal.')
      return
    }
    if (!importFile) {
      setImportError('Pilih file CSV/XLSX untuk diimport.')
      return
    }
    if (!isAllowedImportFile(importFile)) {
      setImportError('Format file tidak didukung. Gunakan CSV/XLSX.')
      return
    }

    setImportError(null)
    setImporting(true)
    try {
      const res = await kuisAPI.importSoal(draftKuisId, importFile)
      if (!res?.success) {
        alert(res?.message || 'Gagal import soal')
        return
      }

      const responseData = (res as any)?.data ?? res
      const importedCount =
        Number((responseData as any)?.imported_count ?? (responseData as any)?.imported ?? 0) ||
        (Array.isArray((responseData as any)?.soal) ? (responseData as any).soal.length : 0)
      alert(
        importedCount > 0
          ? `Import soal berhasil. ${importedCount} soal masuk ke kuis.`
          : 'Import soal berhasil!'
      )
      setImportFile(null)

      const soalRaw = Array.isArray((responseData as any)?.soal)
        ? (responseData as any).soal
        : Array.isArray((responseData as any)?.questions)
          ? (responseData as any).questions
          : []

      if (soalRaw.length > 0) {
        const tryParseJson = (value: any) => {
          if (typeof value !== 'string') return value
          const s = value.trim()
          if (!s) return value
          if (!(s.startsWith('{') || s.startsWith('['))) return value
          try {
            return JSON.parse(s)
          } catch {
            return value
          }
        }
        const pickString = (...values: any[]) => {
          for (const v of values) {
            if (typeof v === 'string' && v.trim().length > 0) return v
          }
          return ''
        }
        const coerceChoiceOptions = (raw: any): ChoiceOptions => {
          const parsed = tryParseJson(raw)
          if (Array.isArray(parsed)) {
            const arr = parsed.map((x) => String(x ?? ''))
            return {
              A: String(arr[0] ?? ''),
              B: String(arr[1] ?? ''),
              C: String(arr[2] ?? ''),
              D: String(arr[3] ?? ''),
              E: String(arr[4] ?? ''),
            }
          }
          const obj = parsed && typeof parsed === 'object' ? parsed : {}
          const get = (k: string) => String((obj as any)[k] ?? (obj as any)[k.toLowerCase()] ?? '')
          return { A: get('A'), B: get('B'), C: get('C'), D: get('D'), E: get('E') }
        }
        const coerceQuestion = (q: any): Question => {
          const raw = tryParseJson(q)
          const id = String((raw as any)?.id ?? `q-${Date.now()}-${Math.random().toString(16).slice(2)}`)
          const text = pickString((raw as any)?.text, (raw as any)?.pertanyaan, (raw as any)?.question, (raw as any)?.prompt)
          const optionsRaw = (raw as any)?.options ?? (raw as any)?.pilihan ?? (raw as any)?.choices
          const options = coerceChoiceOptions(optionsRaw)
          const answerRaw = (raw as any)?.answer ?? (raw as any)?.jawaban ?? (raw as any)?.correct ?? (raw as any)?.kunci
          const answerStr = typeof answerRaw === 'string' ? answerRaw.trim().toUpperCase() : answerRaw
          const answer: ChoiceKey = isChoiceKey(answerStr) ? answerStr : 'A'
          const image = typeof (raw as any)?.image === 'string' ? (raw as any).image : undefined
          return { id, text, image, options, answer }
        }

        const qs = soalRaw.map(coerceQuestion)
        setDraftQuestions(qs.length > 0 ? qs : [createDraftQuestion()])
        setNumQuestions(Math.max(qs.length, 1))
      } else {
        // Refresh draft if backend only returns metadata and not the questions themselves.
        const refreshed = await kuisAPI.getById(String(draftKuisId))
        const data = (refreshed as any)?.data
        const soalReloaded = Array.isArray(data?.soal)
          ? data.soal
          : Array.isArray(data?.questions)
            ? data.questions
            : []

        const tryParseJson = (value: any) => {
          if (typeof value !== 'string') return value
          const s = value.trim()
          if (!s) return value
          if (!(s.startsWith('{') || s.startsWith('['))) return value
          try {
            return JSON.parse(s)
          } catch {
            return value
          }
        }
        const pickString = (...values: any[]) => {
          for (const v of values) {
            if (typeof v === 'string' && v.trim().length > 0) return v
          }
          return ''
        }
        const coerceChoiceOptions = (raw: any): ChoiceOptions => {
          const parsed = tryParseJson(raw)
          if (Array.isArray(parsed)) {
            const arr = parsed.map((x) => String(x ?? ''))
            return {
              A: String(arr[0] ?? ''),
              B: String(arr[1] ?? ''),
              C: String(arr[2] ?? ''),
              D: String(arr[3] ?? ''),
              E: String(arr[4] ?? ''),
            }
          }
          const obj = parsed && typeof parsed === 'object' ? parsed : {}
          const get = (k: string) => String((obj as any)[k] ?? (obj as any)[k.toLowerCase()] ?? '')
          return { A: get('A'), B: get('B'), C: get('C'), D: get('D'), E: get('E') }
        }
        const coerceQuestion = (q: any): Question => {
          const raw = tryParseJson(q)
          const id = String((raw as any)?.id ?? `q-${Date.now()}-${Math.random().toString(16).slice(2)}`)
          const text = pickString((raw as any)?.text, (raw as any)?.pertanyaan, (raw as any)?.question, (raw as any)?.prompt)
          const optionsRaw = (raw as any)?.options ?? (raw as any)?.pilihan ?? (raw as any)?.choices
          const options = coerceChoiceOptions(optionsRaw)
          const answerRaw = (raw as any)?.answer ?? (raw as any)?.jawaban ?? (raw as any)?.correct ?? (raw as any)?.kunci
          const answerStr = typeof answerRaw === 'string' ? answerRaw.trim().toUpperCase() : answerRaw
          const answer: ChoiceKey = isChoiceKey(answerStr) ? answerStr : 'A'
          const image = typeof (raw as any)?.image === 'string' ? (raw as any).image : undefined
          return { id, text, image, options, answer }
        }

        const qs = soalReloaded.map(coerceQuestion)
        setDraftQuestions(qs.length > 0 ? qs : [createDraftQuestion()])
        setNumQuestions(Math.max(qs.length, 1))
      }
    } catch (error: any) {
      console.error('Error import soal:', error)
      setImportError(formatApiErrorAlert('Gagal import soal.', error))
    } finally {
      setImporting(false)
    }
  }

  const isQuestionComplete = (q: Question) => {
    if (q.text.trim().length === 0) return false
    const filledAll = (Object.keys(DEFAULT_OPTIONS) as ChoiceKey[]).every((k) => q.options[k].trim().length > 0)
    if (!filledAll) return false
    return q.options[q.answer].trim().length > 0
  }

  const mapQuestionPayload = (q: Question) => ({
    id: q.id,
    text: q.text.trim(),
    image: q.image,
    options: {
      A: q.options.A.trim(),
      B: q.options.B.trim(),
      C: q.options.C.trim(),
      D: q.options.D.trim(),
      E: q.options.E.trim(),
    },
    answer: q.answer,
  })

  const mapQuestionPayloadForApi = (q: Question) => ({
    id: q.id,
    pertanyaan: q.text.trim(),
    image: q.image,
    pilihan: {
      A: q.options.A.trim(),
      B: q.options.B.trim(),
      C: q.options.C.trim(),
      D: q.options.D.trim(),
      E: q.options.E.trim(),
    },
    jawaban: q.answer,
  })

  const canSubmit = useMemo(() => {
    if (draftQuestions.length === 0) return false
    return draftQuestions.every(isQuestionComplete)
  }, [draftQuestions])

  const isQuestionStarted = (q: Question) => {
    if (q.text.trim().length > 0) return true
    if (q.image && String(q.image).trim().length > 0) return true
    return (Object.keys(DEFAULT_OPTIONS) as ChoiceKey[]).some((k) => q.options[k].trim().length > 0)
  }

  const kelasIdForApi = useMemo(() => {
    const s = String(kelas ?? '').trim()
    if (/^\d+$/.test(s)) return Number(s)
    return s
  }, [kelas])

  async function handleSaveDraft() {
    if (saving) return
    setSaving(true)
    try {
      // Untuk Draft: simpan semua soal apa adanya (boleh belum lengkap),
      // agar bisa dilanjutkan langsung dari backend.
      const draftPayloadQuestions = draftQuestions.map(mapQuestionPayloadForApi)
      const res = isEditDraft && draftKuisId
        ? await kuisAPI.update(draftKuisId, {
            judul: String(title ?? '').trim(),
            kelas_ids: [kelasIdForApi],
            batas_waktu: safeBatasWaktu,
            status: 'Draft',
            total_soal: numQuestions,
            jumlah_soal: numQuestions,
            draft_soal_count: numQuestions,
            soal: draftPayloadQuestions,
          })
        : await kuisAPI.create({
            judul: String(title ?? '').trim(),
            kelas_ids: [kelasIdForApi],
            batas_waktu: safeBatasWaktu,
            status: 'Draft',
            total_soal: numQuestions,
            jumlah_soal: numQuestions,
            draft_soal_count: numQuestions,
            soal: draftPayloadQuestions,
          })
      if (res.success) {
        alert('Draft kuis berhasil disimpan!')
        navigate('/guru/kuis')
      } else {
        alert('Gagal menyimpan draft kuis. Silakan coba lagi.')
      }
    } catch (error) {
      console.error('Error saving draft kuis:', error)
      alert(formatApiErrorAlert('Gagal menyimpan draft kuis.', error))
    } finally {
      setSaving(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    if (saving) return

    // When clicking "Simpan Kuis", publish the quiz.
    // Draft saving is handled by the separate "Simpan Draft" button.
    const publishStatus: KuisStatus = status === 'Selesai' ? 'Selesai' : 'Aktif'

    // Mode lanjut draft: update kuis yang sama.
    if (isEditDraft && draftKuisId) {
      setSaving(true)
      void kuisAPI
        .update(draftKuisId, {
          judul: String(title ?? '').trim(),
          kelas_ids: [kelasIdForApi],
          batas_waktu: safeBatasWaktu,
          status: publishStatus,
          total_soal: numQuestions,
          jumlah_soal: numQuestions,
          draft_soal_count: numQuestions,
          soal: draftQuestions.map(mapQuestionPayloadForApi),
        })
        .then((res: any) => {
          if (res?.success) {
            alert('Kuis berhasil disimpan!')
            navigate('/guru/kuis')
          } else {
            alert('Gagal menyimpan kuis. Silakan coba lagi.')
          }
        })
        .catch((error: any) => {
          console.error('Error updating kuis draft:', error)
          alert(formatApiErrorAlert('Gagal menyimpan kuis.', error))
        })
        .finally(() => setSaving(false))
      return
    }

    // Mode lama: kirim data kembali ke halaman utama (akan create di halaman /guru/kuis)
    navigate('/guru/kuis', {
      state: {
        newKuis: {
          title,
          kelas,
          status: publishStatus,
          batasWaktu: safeBatasWaktu,
          questions: draftQuestions.map(mapQuestionPayload),
        },
      },
    })
  }

  function handleImageUpload(questionId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validasi ukuran (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran gambar maksimal 2MB')
      return
    }

    // Validasi tipe file
    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar')
      return
    }

    // Convert ke base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setDraftQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, image: base64 } : q))
      )
    }
    reader.readAsDataURL(file)
  }

  function removeImage(questionId: string) {
    setDraftQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, image: undefined } : q))
    )
  }

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/guru/kuis')}
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <div className="text-xs font-semibold tracking-wide text-slate-500">ISI SOAL KUIS</div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-800">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Total {numQuestions} soal • Durasi: {safeBatasWaktu} menit • Status: {status}
          </p>
        </div>
      </div>

      {loadingDraft ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
          Memuat draft kuis...
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-extrabold text-slate-800">Import Soal (CSV/XLSX)</div>
              <div className="mt-1 text-xs text-slate-600">
                Gunakan template kolom: pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, jawaban_benar (A-E)
              </div>
            </div>
            {!draftKuisId ? (
              <div className="text-xs font-semibold text-amber-700">
                Simpan Draft dulu untuk mendapatkan ID kuis.
              </div>
            ) : null}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3 sm:items-end">
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-slate-700">File</label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                disabled={!draftKuisId || importing || saving || loadingDraft}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setImportFile(file)
                  setImportError(null)
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-100 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-amber-800"
              />
              <div className="mt-2 text-xs text-slate-500">
                {importFile ? importFile.name : 'Belum ada file dipilih'}
              </div>
              {importError ? (
                <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  {importError}
                </div>
              ) : null}
            </div>
            <div>
              <button
                type="button"
                onClick={handleImportSoal}
                disabled={!draftKuisId || importing || saving || loadingDraft}
                className={
                  'w-full rounded-xl px-4 py-3 text-sm font-semibold shadow-sm ' +
                  (!draftKuisId || importing || saving || loadingDraft
                    ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                    : 'bg-amber-500 text-white hover:bg-amber-600')
                }
              >
                {importing ? 'Mengimpor...' : 'Import Soal'}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-extrabold text-slate-800">Progress Soal</div>
          <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
            {draftQuestions.map((q, idx) => {
              const filled = isQuestionStarted(q)
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`soal-${q.id}`)
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={
                    'flex h-10 items-center justify-center rounded-lg border text-sm font-extrabold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-200 ' +
                    (filled
                      ? 'border-amber-200 bg-amber-500 text-white'
                      : 'border-slate-200 bg-white text-slate-700')
                  }
                  aria-label={filled ? `Soal ${idx + 1} sudah diisi` : `Soal ${idx + 1} belum diisi`}
                  title={filled ? `Soal ${idx + 1} sudah diisi` : `Soal ${idx + 1} belum diisi`}
                >
                  {idx + 1}
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => {
                if (saving || loadingDraft) return
                const next = createDraftQuestion()
                setDraftQuestions((prev) => [...prev, next])
                setNumQuestions((prev) => Math.max(1, Number(prev) || 0) + 1)
                // Scroll ke soal yang baru ditambah
                setTimeout(() => {
                  const el = document.getElementById(`soal-${next.id}`)
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }, 0)
              }}
              disabled={saving || loadingDraft}
              className={
                'flex h-10 items-center justify-center rounded-lg border text-sm font-extrabold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-200 ' +
                (saving || loadingDraft
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                  : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100')
              }
              aria-label="Tambah soal"
              title="Tambah soal"
            >
              +
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {draftQuestions.map((q, idx) => (
            <div
              key={q.id}
              id={`soal-${q.id}`}
              className="scroll-mt-24 rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="text-sm font-extrabold text-slate-800">Soal {idx + 1}</div>
              </div>

              <div className="mt-3">
                <label className="text-sm font-semibold text-slate-700">Pertanyaan</label>
                <input
                  value={q.text}
                  onChange={(e) => {
                    const value = e.target.value
                    setDraftQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, text: value } : x)))
                  }}
                  type="text"
                  placeholder="Contoh: 2 + 3 = ..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-amber-400"
                />
              </div>

              {/* Upload Gambar Soal */}
              <div className="mt-3">
                <label className="text-sm font-semibold text-slate-700">Gambar Soal (Opsional)</label>
                {q.image ? (
                  <div className="mt-2 space-y-2">
                    <img src={q.image} alt="Soal" className="max-h-48 rounded-xl border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => removeImage(q.id)}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      <Icon name="x" />
                      Hapus Gambar
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(q.id, e)}
                        className="hidden"
                      />
                      <Icon name="paperclip" />
                      Upload Gambar
                    </label>
                    <div className="mt-1 text-xs text-slate-500">Max 2MB</div>
                  </div>
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(['A', 'B', 'C', 'D', 'E'] as const).map((key) => (
                  <div key={key}>
                    <label className="text-sm font-semibold text-slate-700">Pilihan {key}</label>
                    <input
                      value={q.options[key]}
                      onChange={(e) => {
                        const value = e.target.value
                        setDraftQuestions((prev) =>
                          prev.map((x) => (x.id === q.id ? { ...x, options: { ...x.options, [key]: value } } : x))
                        )
                      }}
                      type="text"
                      placeholder={`Jawaban ${key}`}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-amber-400"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <label className="text-sm font-semibold text-slate-700">Kunci jawaban</label>
                <div className="mt-2">
                  <ResponsiveSelect
                    value={q.answer}
                    onChange={(value) => {
                      if (!isChoiceKey(value)) return
                      setDraftQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, answer: value } : x)))
                    }}
                    placeholder="Pilih Jawaban"
                    includeEmptyOption={false}
                    options={[
                      { value: 'A', label: 'A' },
                      { value: 'B', label: 'B' },
                      { value: 'C', label: 'C' },
                      { value: 'D', label: 'D' },
                      { value: 'E', label: 'E' },
                    ]}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Jawaban benar: <span className="font-semibold text-slate-700">{q.answer}</span>
                  {q.options[q.answer].trim().length > 0 ? (
                    <span className="text-slate-500"> — {q.options[q.answer].trim()}</span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 mt-6 flex gap-3 border-t border-slate-200 bg-white pt-4">
          <button
            type="button"
            onClick={() => navigate('/guru/kuis')}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Batal
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving}
            className={
              'flex-1 rounded-xl border px-6 py-3 text-sm font-semibold ' +
              (saving
                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100')
            }
          >
            Simpan Draft
          </button>
          <button
            type="submit"
            disabled={!canSubmit || saving}
            className={
              'flex-1 rounded-xl px-6 py-3 text-sm font-semibold shadow-sm ' +
              (canSubmit && !saving
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'cursor-not-allowed bg-slate-200 text-slate-500')
            }
          >
            Simpan Kuis
          </button>
        </div>
      </form>
    </div>
  )
}
