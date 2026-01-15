import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { tambahNotifikasi } from '../../lib/idbNotifikasi'

type KuisStatus = 'Aktif' | 'Draft' | 'Selesai'

type ChoiceKey = 'A' | 'B' | 'C' | 'D' | 'E'

type ChoiceOptions = Record<ChoiceKey, string>

type Question =
  | {
      id: string
      text: string
      image?: string
    }
  | {
      id: string
      text: string
      image?: string
      options: ChoiceOptions
      answer: ChoiceKey
    }

type KuisItem = {
  id: string
  title: string
  status: KuisStatus
  peserta: number
  questions: Question[]
}

const STORAGE_KEY = 'jk_teacher_kuis'

const defaultKuis: KuisItem[] = [
  {
    id: 'k-1',
    title: 'Kuis 1: Aljabar',
    status: 'Aktif',
    peserta: 28,
    questions: [
      {
        id: 'q-1',
        text: 'Apa itu variabel dalam aljabar?',
        options: {
          A: 'Angka yang nilainya tetap',
          B: 'Simbol/ huruf yang mewakili nilai yang bisa berubah',
          C: 'Operator matematika',
          D: 'Hasil akhir perhitungan',
          E: 'Satuan ukuran',
        },
        answer: 'B',
      },
    ],
  },
  { id: 'k-2', title: 'Kuis 2: Persamaan', status: 'Draft', peserta: 0, questions: [] },
  { id: 'k-3', title: 'Kuis 3: Bangun Datar', status: 'Selesai', peserta: 25, questions: [] },
]

function isChoiceKey(v: unknown): v is ChoiceKey {
  return v === 'A' || v === 'B' || v === 'C' || v === 'D' || v === 'E'
}

function normalizeKuis(input: unknown): KuisItem[] {
  if (!Array.isArray(input)) return defaultKuis

  const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

  return input.map((raw) => {
    if (!isRecord(raw)) {
      return {
        id: `k-${Date.now()}`,
        title: 'Kuis',
        status: 'Draft',
        peserta: 0,
        questions: [],
      }
    }

    const id = typeof raw.id === 'string' ? raw.id : `k-${Date.now()}`
    const title = typeof raw.title === 'string' ? raw.title : 'Kuis'
    const peserta = typeof raw.peserta === 'number' ? raw.peserta : 0

    const status: KuisStatus =
      raw.status === 'Aktif' || raw.status === 'Draft' || raw.status === 'Selesai' ? raw.status : 'Draft'

    const rawQuestions = raw.questions
    const questions: Question[] = Array.isArray(rawQuestions)
      ? rawQuestions
          .map((q) => {
            if (!isRecord(q)) return null
            const text = typeof q.text === 'string' ? q.text : null
            if (!text) return null
            const qid = typeof q.id === 'string' ? q.id : `q-${Date.now()}`

            const rawOptions = q.options
            const rawAnswer = q.answer

            const hasAnswer = isChoiceKey(rawAnswer)
            const isOptionsRecord = isRecord(rawOptions)

            if (hasAnswer && isOptionsRecord) {
              const options: ChoiceOptions = {
                A: typeof rawOptions.A === 'string' ? rawOptions.A : '',
                B: typeof rawOptions.B === 'string' ? rawOptions.B : '',
                C: typeof rawOptions.C === 'string' ? rawOptions.C : '',
                D: typeof rawOptions.D === 'string' ? rawOptions.D : '',
                E: typeof rawOptions.E === 'string' ? rawOptions.E : '',
              }

              return { id: qid, text, options, answer: rawAnswer }
            }

            return { id: qid, text }
          })
          .filter((q): q is Question => q !== null)
      : []

    return { id, title, status, peserta, questions }
  })
}

function loadKuis(): KuisItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultKuis
    const parsed = JSON.parse(raw) as unknown
    return normalizeKuis(parsed)
  } catch {
    return defaultKuis
  }
}

export default function TeacherKuis() {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState<KuisItem[]>(() => loadKuis())
  const [showForm, setShowForm] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<KuisStatus>('Aktif')
  const [numQuestions, setNumQuestions] = useState(5)

  const itemsPerPage = 5
  const totalPages = Math.ceil(items.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = items.slice(startIndex, endIndex)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  // Terima data dari halaman buat soal
  useEffect(() => {
    const state = location.state as { newKuis?: { title: string; status: KuisStatus; questions: Question[] } } | null
    if (state?.newKuis) {
      const newItem: KuisItem = {
        id: `k-${Date.now()}`,
        title: state.newKuis.title,
        status: state.newKuis.status,
        peserta: 0,
        questions: state.newKuis.questions,
      }
      setItems((prev) => [newItem, ...prev])
      
      // Auto-generate notifikasi untuk siswa
      if (newItem.status === 'Aktif') {
        void tambahNotifikasi({
          judul: 'Kuis Baru Tersedia',
          pesan: `Kuis "${newItem.title}" telah aktif dan siap dikerjakan`,
          tipe: 'kuis'
        })
      }
      
      // Clear state
      window.history.replaceState({}, document.title)
    }
  }, [location])

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && numQuestions > 0
  }, [title, numQuestions])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    // Navigate ke halaman buat soal dengan state
    navigate('/guru/kuis/buat-soal', {
      state: {
        title: title.trim(),
        status,
        numQuestions,
      },
    })
  }

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wide text-slate-500">KUIS</div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-800">Kelola kuis</h1>
          <p className="mt-2 text-sm text-slate-600">Guru bisa menambahkan kuis. Sementara disimpan di localStorage.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            + Tambah Kuis
          </button>
        )}
      </div>

      {showForm && (
        <form className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Judul kuis</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                type="text"
                placeholder="Contoh: Kuis Bab 1"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as KuisStatus)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 focus:border-amber-400"
              >
                <option value="Draft">Draft</option>
                <option value="Aktif">Aktif</option>
                <option value="Selesai">Selesai</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Jumlah Soal</label>
              <input
                value={numQuestions}
                onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                type="number"
                min="1"
                max="50"
                placeholder="5"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-amber-400"
              />
              <div className="mt-1 text-xs text-slate-500">Maksimal 50 soal</div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setTitle('')
                setStatus('Aktif')
                setNumQuestions(5)
              }}
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={
                'flex-1 rounded-xl px-6 py-3 text-sm font-semibold shadow-sm ' +
                (canSubmit ? 'bg-amber-500 text-white hover:bg-amber-600' : 'cursor-not-allowed bg-slate-200 text-slate-500')
              }
            >
              Lanjut ke Isi Soal →
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {currentItems.map((k) => {
          return (
            <div
              key={k.id}
              onClick={() => navigate(`/guru/kuis/${k.id}`)}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-base font-extrabold text-slate-800">{k.title}</div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span>{k.peserta} peserta</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>{k.questions.length} soal</span>
                    </div>
                  </div>
                </div>
                <div
                  className={
                    'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ' +
                    (k.status === 'Aktif'
                      ? 'bg-amber-100 text-amber-800'
                      : k.status === 'Selesai'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-700')
                  }
                >
                  {k.status}
                </div>
              </div>

              {/* Arrow Icon */}
              <div className="mt-3 flex items-center justify-end">
                <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={
              'rounded-lg px-3 py-2 text-sm font-semibold ' +
              (currentPage === 1
                ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50')
            }
          >
            ← Sebelumnya
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={
                  'h-9 w-9 rounded-lg text-sm font-semibold transition-colors ' +
                  (currentPage === page
                    ? 'bg-amber-500 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50')
                }
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={
              'rounded-lg px-3 py-2 text-sm font-semibold ' +
              (currentPage === totalPages
                ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50')
            }
          >
            Selanjutnya →
          </button>
        </div>
      )}
    </div>
  )
}
