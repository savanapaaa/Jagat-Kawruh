import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { putFile } from '../../lib/idbFiles'
import { tambahNotifikasi } from '../../lib/idbNotifikasi'

type MateriStatus = 'Dipublikasikan' | 'Draft'

type MateriItem = {
  id: string
  title: string
  kelas: string
  status: MateriStatus
  fileId?: string
  fileName?: string
  fileSize?: number
}

const STORAGE_KEY = 'jk_teacher_materi'

const defaultMateri: MateriItem[] = [
  { id: 'm-1', title: 'Pengenalan Aljabar', kelas: 'VII', status: 'Dipublikasikan' },
  { id: 'm-2', title: 'Persamaan Linear', kelas: 'VII', status: 'Draft' },
  { id: 'm-3', title: 'Bangun Datar', kelas: 'VIII', status: 'Dipublikasikan' },
]

function loadMateri(): MateriItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultMateri
    const parsed = JSON.parse(raw) as MateriItem[]
    if (!Array.isArray(parsed)) return defaultMateri
    return parsed
  } catch {
    return defaultMateri
  }
}

export default function TeacherMateri() {
  const navigate = useNavigate()
  const [items, setItems] = useState<MateriItem[]>(() => loadMateri())
  const [showForm, setShowForm] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [title, setTitle] = useState('')
  const [kelas, setKelas] = useState('VII')
  const [status, setStatus] = useState<MateriStatus>('Draft')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const itemsPerPage = 10
  const totalPages = Math.ceil(items.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = items.slice(startIndex, endIndex)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const canSubmit = useMemo(() => title.trim().length > 0 && !!pdfFile && !pdfError, [title, pdfFile, pdfError])

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wide text-slate-500">MATERI</div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-800">Manajemen materi</h1>
          <p className="mt-2 text-sm text-slate-600">Guru bisa menambahkan materi (PDF). Metadata disimpan di localStorage.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            + Tambah Materi
          </button>
        )}
      </div>

      {showForm && (
        <form
          className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4"
          onSubmit={(e) => {
          e.preventDefault()
          if (!canSubmit) return

          const fileId = `pdf-${Date.now()}`
          const file = pdfFile
          if (!file) return

          void putFile({ id: fileId, blob: file, name: file.name })

          const newItem: MateriItem = {
            id: `m-${Date.now()}`,
            title: title.trim(),
            kelas,
            status,
            fileId,
            fileName: file.name,
            fileSize: file.size,
          }

          setItems((prev) => [newItem, ...prev])
          
          // Auto-generate notifikasi untuk siswa
          if (status === 'Dipublikasikan') {
            void tambahNotifikasi({
              judul: 'Materi Baru Tersedia',
              pesan: `Materi "${title.trim()}" untuk kelas ${kelas} telah ditambahkan`,
              tipe: 'materi'
            })
          }
          
          setTitle('')
          setStatus('Draft')
          setPdfFile(null)
          setPdfError(null)
          setShowForm(false)
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold text-slate-700">Judul materi</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              type="text"
              placeholder="Contoh: Operasi Bilangan Bulat"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-amber-400"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Kelas</label>
            <select
              value={kelas}
              onChange={(e) => setKelas(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 focus:border-amber-400"
            >
              <option value="VII">VII</option>
              <option value="VIII">VIII</option>
              <option value="IX">IX</option>
              <option value="X">X</option>
              <option value="XI">XI</option>
              <option value="XII">XII</option>
            </select>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3 sm:items-end">
          <div className="sm:col-span-2">
            <label className="text-sm font-semibold text-slate-700">File PDF</label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                if (!file) {
                  setPdfFile(null)
                  setPdfError('Pilih file PDF.')
                  return
                }
                const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
                if (!isPdf) {
                  setPdfFile(null)
                  setPdfError('File harus PDF.')
                  return
                }
                setPdfFile(file)
                setPdfError(null)
              }}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-100 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-amber-800"
            />
            <div className="mt-2 text-xs text-slate-500">
              {pdfError ? <span className="font-semibold text-rose-600">{pdfError}</span> : pdfFile ? pdfFile.name : 'Belum ada file dipilih'}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MateriStatus)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 focus:border-amber-400"
            >
              <option value="Draft">Draft</option>
              <option value="Dipublikasikan">Dipublikasikan</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setTitle('')
                  setStatus('Draft')
                  setPdfFile(null)
                  setPdfError(null)
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
                  (canSubmit
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'cursor-not-allowed bg-slate-200 text-slate-500')
                }
              >
                Tambah Materi
              </button>
            </div>
          </div>
        </div>
      </form>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {currentItems.map((m) => (
          <div
            key={m.id}
            onClick={() => navigate(`/guru/materi/${m.id}`)}
            className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-base font-extrabold text-slate-800">{m.title}</div>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span>Kelas {m.kelas}</span>
                  </div>
                  {m.fileName && (
                    <div className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span>PDF</span>
                    </div>
                  )}
                </div>
              </div>
              <div
                className={
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ' +
                  (m.status === 'Dipublikasikan' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700')
                }
              >
                {m.status}
              </div>
            </div>

            {/* Arrow Icon */}
            <div className="mt-3 flex items-center justify-end">
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        ))}
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
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
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
                    ? 'bg-emerald-500 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
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
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
            }
          >
            Selanjutnya →
          </button>
        </div>
      )}
    </div>
  )
}
