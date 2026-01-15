import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { kuisAPI, authAPI, kelasAPI } from '../../lib/api'

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
  judul: string
  status: KuisStatus
  peserta?: number
  soal: Question[]
}

type Kelas = {
  id: string
  nama: string
  tingkat: string
}

export default function TeacherKuis() {
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState<KuisItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [title, setTitle] = useState('')
  const [kelas, setKelas] = useState('')
  const [kelasList, setKelasList] = useState<Kelas[]>([])
  const [status, setStatus] = useState<KuisStatus>('Aktif')
  const [numQuestions, setNumQuestions] = useState(5)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const hasSubmitted = useRef(false)

  const itemsPerPage = 5
  const totalPages = Math.ceil(items.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = items.slice(startIndex, endIndex)

  useEffect(() => {
    loadKelasDiampu()
    loadKuis()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadKelasDiampu() {
    try {
      const meResponse = await authAPI.me()
      if (meResponse.success && meResponse.data) {
        const kelasIds = meResponse.data.kelas_diampu || []
        
        if (kelasIds.length > 0) {
          const kelasResponse = await kelasAPI.getAll()
          if (kelasResponse.success) {
            const allKelas = kelasResponse.data?.data || kelasResponse.data || []
            const kelasDiampu = allKelas.filter((k: any) => 
              kelasIds.includes(k.id) || kelasIds.includes(String(k.id)) || kelasIds.includes(Number(k.id))
            )
            setKelasList(kelasDiampu)
            if (kelasDiampu.length > 0 && !kelas) {
              setKelas(kelasDiampu[0].id)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading kelas diampu:', error)
    }
  }

  async function loadKuis() {
    try {
      const response = await kuisAPI.getAll()
      if (response.success && Array.isArray(response.data)) {
        setItems(response.data)
      }
    } catch (error) {
      console.error('Error loading kuis:', error)
    } finally {
      setLoading(false)
    }
  }

  // Terima data dari halaman buat soal
  useEffect(() => {
    const state = location.state as { newKuis?: { title: string; kelas?: string; status: KuisStatus; questions: Question[] } } | null
    if (state?.newKuis && !isSubmitting && !hasSubmitted.current) {
      setIsSubmitting(true)
      hasSubmitted.current = true
      
      const newItem = {
        judul: state.newKuis.title,
        kelas: [state.newKuis.kelas || 'X'],
        batas_waktu: 30,
        status: state.newKuis.status,
        soal: state.newKuis.questions,
      }
      
      kuisAPI.create(newItem)
        .then((response) => {
          if (response.success) {
            loadKuis()
            alert('Kuis berhasil dibuat!')
          }
        })
        .catch(err => {
          console.error('Error creating kuis:', err)
          alert('Gagal membuat kuis: ' + (err.message || 'Unknown error'))
        })
        .finally(() => {
          setIsSubmitting(false)
          // Clear state setelah selesai
          navigate(location.pathname, { replace: true, state: {} })
          // Reset ref untuk submission berikutnya (kalau ada)
          setTimeout(() => { hasSubmitted.current = false }, 100)
        })
    }
  }, [location.state, isSubmitting, navigate, location.pathname])

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
        kelas,
        status,
        numQuestions,
      },
    })
  }

  async function handleDelete(id: string, judul: string) {
    if (confirm(`Hapus kuis "${judul}"?`)) {
      try {
        const response = await kuisAPI.delete(id)
        if (response.success) {
          await loadKuis()
          alert('Kuis berhasil dihapus!')
        }
      } catch (error) {
        console.error('Error deleting kuis:', error)
        alert('Gagal menghapus kuis')
      }
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat data kuis...</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-white p-4 sm:p-6 lg:p-7 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wide text-slate-500">KUIS</div>
          <h1 className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-800">Kelola kuis</h1>
          <p className="mt-2 text-sm text-slate-600">Guru bisa menambahkan kuis baru dan melihat peserta.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600"
          >
            + Tambah Kuis
          </button>
        )}
      </div>

      {showForm && (
        <form className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Judul kuis</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                type="text"
                placeholder="Contoh: Kuis Aljabar"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Kelas</label>
              <select
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 focus:border-amber-400"
                required
              >
                {kelasList.length === 0 ? (
                  <option value="">Tidak ada kelas yang diampu</option>
                ) : (
                  kelasList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))
                )}
              </select>
              {kelasList.length === 0 && (
                <p className="mt-1 text-xs text-red-500">
                  Anda belum diamanahi kelas. Hubungi admin untuk menambahkan kelas.
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">Jumlah soal</label>
              <input
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value) || 0)}
                type="number"
                min="1"
                max="50"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as KuisStatus)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 focus:border-amber-400"
              >
                <option value="Aktif">Aktif</option>
                <option value="Draft">Draft</option>
                <option value="Selesai">Selesai</option>
              </select>
            </div>

            <div className="md:col-span-2 flex flex-col gap-2 sm:flex-row sm:items-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setTitle('')
                  setKelas('X')
                  setStatus('Aktif')
                  setNumQuestions(5)
                }}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Buat Soal
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Judul</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Status</th>
              <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Peserta</th>
              <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Soal</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada kuis. Klik "Tambah Kuis" untuk membuat.
                </td>
              </tr>
            ) : (
              currentItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-800">{item.judul}</div>
                    <div className="mt-1 flex items-center gap-2 md:hidden text-xs text-slate-500">
                      <span>{item.peserta || 0} peserta</span>
                      <span>•</span>
                      <span>{item.soal?.length || 0} soal</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        item.status === 'Aktif'
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.status === 'Draft'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-center text-sm text-slate-600">{item.peserta || 0}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-center text-sm text-slate-600">{item.soal?.length || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 overflow-x-auto md:justify-end">
                      <button
                        onClick={() => navigate(`/guru/kuis/${item.id}`)}
                        className="flex-shrink-0 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                      >
                        Detail
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.judul)}
                        className="flex-shrink-0 rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200"
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

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Prev
          </button>
          <div className="text-sm text-slate-600">
            Halaman {currentPage} dari {totalPages}
          </div>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
