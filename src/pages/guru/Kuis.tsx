import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { kuisAPI, authAPI, kelasAPI, formatApiErrorAlert } from '../../lib/api'
import ResponsiveSelect from '../../components/ui/ResponsiveSelect'

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
  total_soal?: number
  total_questions?: number
  jumlah_soal?: number
  draft_soal_count?: number
  totalSoal?: number
  jumlahSoal?: number
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
  const [selectedKelasIds, setSelectedKelasIds] = useState<string[]>([])
  const [kelasList, setKelasList] = useState<Kelas[]>([])
  const [status, setStatus] = useState<KuisStatus>('Aktif')
  const [numQuestions, setNumQuestions] = useState(5)
  const [batasWaktu, setBatasWaktu] = useState(30)
  const [loading, setLoading] = useState(true)
  const [pesertaByKuisId, setPesertaByKuisId] = useState<Record<string, number>>({})
  const [attemptsByKuisId, setAttemptsByKuisId] = useState<Record<string, number>>({})
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
        // Handle nested user object atau direct data
        const userData = meResponse.data.user || meResponse.data
        const kelasData = userData.kelas_diampu || []
        
        if (Array.isArray(kelasData) && kelasData.length > 0) {
          // Jika berisi object dengan property nama/id (format baru dari backend)
          if (typeof kelasData[0] === 'object' && kelasData[0].nama) {
            setKelasList(kelasData)
            if (selectedKelasIds.length === 0 && kelasData.length > 0) setSelectedKelasIds([String(kelasData[0].id)])
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
                if (selectedKelasIds.length === 0 && kelasDiampu.length > 0) setSelectedKelasIds([String(kelasDiampu[0].id)])
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
            if (selectedKelasIds.length === 0 && kelasData.length > 0) setSelectedKelasIds([String(kelasData[0])])
            return
          }
        }
      }
      
      // Fallback: load all kelas from backend.
      // Avoid creating quizzes with legacy tingkat IDs like "X".
      const kelasResponse = await kelasAPI.getAll()
      if (kelasResponse.success) {
        const allKelas = kelasResponse.data?.data || kelasResponse.data || []
        if (Array.isArray(allKelas) && allKelas.length > 0) {
          setKelasList(allKelas)
          if (selectedKelasIds.length === 0) setSelectedKelasIds([String(allKelas[0].id)])
          return
        }
      }

      setKelasList([])
      if (selectedKelasIds.length === 0) setSelectedKelasIds([])
    } catch (error) {
      console.error('Error loading kelas diampu:', error)

      setKelasList([])
      if (selectedKelasIds.length === 0) setSelectedKelasIds([])
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

  function extractArrayFromPayload(value: any): any[] {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== 'object') return []
    const directKeys = ['data', 'items', 'results', 'rows', 'attempts', 'kuis_attempts']
    for (const key of directKeys) {
      const v = (value as any)[key]
      if (Array.isArray(v)) return v
    }
    const data = (value as any).data
    if (data && typeof data === 'object') {
      if (Array.isArray((data as any).data)) return (data as any).data
      for (const key of directKeys) {
        const v = (data as any)[key]
        if (Array.isArray(v)) return v
        if (v && typeof v === 'object' && Array.isArray((v as any).data)) return (v as any).data
      }
    }
    return []
  }

  function countUniqueParticipants(list: any[]): number {
    if (!Array.isArray(list) || list.length === 0) return 0

    const unique = new Set<string>()
    for (const item of list) {
      const studentKey =
        item?.siswa_id ??
        item?.user_id ??
        item?.student_id ??
        item?.siswa?.id ??
        item?.user?.id ??
        item?.email ??
        item?.siswa_email ??
        item?.user_email ??
        item?.siswa_nama ??
        item?.nama_siswa ??
        item?.name

      if (studentKey != null && String(studentKey).trim().length > 0) {
        unique.add(String(studentKey))
      }
    }

    return unique.size > 0 ? unique.size : list.length
  }

  useEffect(() => {
    if (!Array.isArray(currentItems) || currentItems.length === 0) return

    const ids = currentItems
      .map((x) => String(x?.id ?? '').trim())
      .filter(Boolean)

    const need = ids.filter((id) => pesertaByKuisId[id] == null)
    const needAttempts = ids.filter((id) => attemptsByKuisId[id] == null)
    if (need.length === 0 && needAttempts.length === 0) return

    let cancelled = false
    ;(async () => {
      try {
        const pairs = await Promise.all(
          Array.from(new Set([...need, ...needAttempts])).map(async (kuisId) => {
            try {
              const res = await kuisAPI.listAttempts(kuisId)
              const list = extractArrayFromPayload(res)
              const totalAttempts = Array.isArray(list) ? list.length : 0
              const uniqueParticipants = countUniqueParticipants(list)
              return [kuisId, uniqueParticipants, totalAttempts] as const
            } catch {
              return [kuisId, 0, 0] as const
            }
          })
        )

        if (cancelled) return
        setPesertaByKuisId((prev) => {
          const next = { ...prev }
          for (const [kuisId, uniqueCount] of pairs) {
            next[kuisId] = uniqueCount
          }
          return next
        })
        setAttemptsByKuisId((prev) => {
          const next = { ...prev }
          for (const [kuisId, , totalAttempts] of pairs) {
            next[kuisId] = totalAttempts
          }
          return next
        })
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItems])

  // Terima data dari halaman buat soal
  useEffect(() => {
    const state = location.state as {
      newKuis?: { title: string; kelas?: string | string[]; status: KuisStatus; questions: Question[]; batasWaktu?: number }
    } | null
    if (state?.newKuis && !isSubmitting && !hasSubmitted.current) {
      setIsSubmitting(true)
      hasSubmitted.current = true

      const limit = Number(state.newKuis.batasWaktu ?? batasWaktu)
      const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 30
      
      const newItem = {
        judul: state.newKuis.title,
        // Backend now requires kelas_ids and will auto-fill legacy `kelas` from tingkat.
        kelas_ids: state.newKuis.kelas
          ? (Array.isArray(state.newKuis.kelas) ? state.newKuis.kelas : [state.newKuis.kelas]).map(k => /^\d+$/.test(String(k)) ? Number(k) : String(k))
          : [],
        batas_waktu: safeLimit,
        status: state.newKuis.status,
        soal: state.newKuis.questions,
      }

      if (newItem.kelas_ids.length === 0) {
        alert('Pilih kelas terlebih dahulu sebelum membuat kuis.')
        setIsSubmitting(false)
        // Clear state supaya tidak loop submit
        navigate(location.pathname, { replace: true, state: {} })
        setTimeout(() => {
          hasSubmitted.current = false
        }, 100)
        return
      }
      
      kuisAPI.create(newItem)
        .then((response) => {
          if (response.success) {
            loadKuis()
            alert('Kuis berhasil dibuat!')
          }
        })
        .catch((err: any) => {
          console.error('Error creating kuis:', err)
          if (err?.status === 403) {
            alert(
              'Gagal membuat kuis. Akses ditolak (Forbidden).\n\n' +
                'Akun ini tidak memiliki izin untuk membuat kuis.\n' +
                '- Pastikan login sebagai Guru/Admin\n' +
                '- Pastikan guru sudah memiliki kelas diampu (kelas_diampu) untuk kelas yang dipilih\n\n' +
                (err?.message ? `Detail: ${String(err.message)}` : '')
            )
            return
          }
          alert(formatApiErrorAlert('Gagal membuat kuis.', err))
        })
        .finally(() => {
          setIsSubmitting(false)
          // Clear state setelah selesai
          navigate(location.pathname, { replace: true, state: {} })
          // Reset ref untuk submission berikutnya (kalau ada)
          setTimeout(() => {
            hasSubmitted.current = false
          }, 100)
        })
    }
  }, [location.state, isSubmitting, navigate, location.pathname])

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && numQuestions > 0 && batasWaktu > 0 && selectedKelasIds.length > 0
  }, [title, numQuestions, batasWaktu, selectedKelasIds])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    // Navigate ke halaman buat soal dengan state
    navigate('/guru/kuis/buat-soal', {
      state: {
        title: title.trim(),
        kelas: selectedKelasIds,
        status,
        numQuestions,
        batasWaktu,
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
        alert('Gagal menghapus kuis. Silakan coba lagi.')
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
          <div className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
            Kuis Guru
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">Manajemen kuis</h1>
          <p className="mt-2 text-sm text-slate-600">Guru bisa menambahkan kuis baru dan melihat peserta.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
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
              <label className="text-sm font-semibold text-slate-700">Terapkan ke Kelas</label>
              <div className="mt-2 flex flex-wrap gap-3">
                {kelasList.length === 0 ? (
                  <p className="text-xs text-red-500">Anda belum diamanahi kelas. Hubungi admin.</p>
                ) : (
                  kelasList.map((k) => {
                    const kid = String(k.id)
                    const isSelected = selectedKelasIds.includes(kid)
                    return (
                      <label key={kid} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors ${isSelected ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedKelasIds(prev => [...prev, kid])
                            } else {
                              setSelectedKelasIds(prev => prev.filter(id => id !== kid))
                            }
                          }}
                        />
                        <div className={`flex h-4 w-4 items-center justify-center rounded ${isSelected ? 'bg-amber-500' : 'border border-slate-300'}`}>
                          {isSelected && <span className="text-white">✓</span>}
                        </div>
                        <span className="font-semibold">{k.nama}</span>
                      </label>
                    )
                  })
                )}
              </div>
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
              <label className="text-sm font-semibold text-slate-700">Batas waktu (menit)</label>
              <input
                value={batasWaktu}
                onChange={(e) => setBatasWaktu(Number(e.target.value) || 0)}
                type="number"
                min="1"
                max="240"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Status</label>
              <div className="mt-2">
                <ResponsiveSelect
                  value={status}
                  onChange={(value) => setStatus(value as KuisStatus)}
                  placeholder="Pilih Status"
                  includeEmptyOption={false}
                  options={[
                    { value: 'Aktif', label: 'Aktif' },
                    { value: 'Draft', label: 'Draf' },
                    { value: 'Selesai', label: 'Selesai' },
                  ]}
                />
              </div>
            </div>

            <div className="md:col-span-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setTitle('')
                  setSelectedKelasIds(kelasList.length > 0 ? [String(kelasList[0].id)] : [])
                  setStatus('Aktif')
                  setNumQuestions(5)
                  setBatasWaktu(30)
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
              <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Attempt</th>
              <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Soal</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada kuis. Klik "Tambah Kuis" untuk membuat.
                </td>
              </tr>
            ) : (
              currentItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-800">{item.judul}</div>
                    <div className="mt-1 flex items-center gap-2 md:hidden text-xs text-slate-500">
                      <span>{(pesertaByKuisId[item.id] ?? item.peserta) || 0} peserta</span>
                      <span>•</span>
                      <span>{(attemptsByKuisId[item.id] ?? 0)} attempt</span>
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
                  <td className="hidden md:table-cell px-4 py-3 text-center text-sm text-slate-600">{(pesertaByKuisId[item.id] ?? item.peserta) || 0}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-center text-sm text-slate-600">{attemptsByKuisId[item.id] || 0}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-center text-sm text-slate-600">
                    {(item as any)?.total_soal ??
                      (item as any)?.total_questions ??
                      (item as any)?.jumlah_soal ??
                      (item as any)?.draft_soal_count ??
                      (item as any)?.totalSoal ??
                      (item as any)?.jumlahSoal ??
                      (item.soal?.length || 0)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 overflow-x-auto md:justify-end">
                      {item.status === 'Draft' ? (
                        <button
                          onClick={() =>
                            navigate('/guru/kuis/buat-soal', {
                              state: {
                                draftKuisId: item.id,
                                expectedCount:
                                  (item as any)?.total_soal ??
                                  (item as any)?.total_questions ??
                                  (item as any)?.jumlah_soal ??
                                  (item as any)?.draft_soal_count ??
                                  (item as any)?.totalSoal ??
                                  (item as any)?.jumlahSoal ??
                                  undefined,
                              },
                            })
                          }
                          className="flex-shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-600"
                        >
                          Lanjutkan
                        </button>
                      ) : null}
                      <button
                        onClick={() => navigate(`/guru/kuis/${item.id}`)}
                        className="flex-shrink-0 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200"
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
            Sebelumnya
          </button>
          <div className="text-sm text-slate-600">
            Halaman {currentPage} dari {totalPages}
          </div>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Berikutnya
          </button>
        </div>
      )}
    </div>
  )
}
