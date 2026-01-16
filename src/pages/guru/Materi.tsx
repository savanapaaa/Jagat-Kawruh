import { useEffect, useMemo, useState } from 'react'
import { materiAPI, authAPI, kelasAPI } from '../../lib/api'

type MateriStatus = 'Dipublikasikan' | 'Draft'

type MateriItem = {
  id: string
  judul: string
  kelas: string
  status: MateriStatus
  file_path?: string
  file_name?: string
  file_size?: number
}

type Kelas = {
  id: string
  nama: string
  tingkat: string
}

export default function TeacherMateri() {
  const [items, setItems] = useState<MateriItem[]>([])
  const [showForm, setShowForm] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [title, setTitle] = useState('')
  const [kelas, setKelas] = useState('')
  const [kelasList, setKelasList] = useState<Kelas[]>([])
  const [status, setStatus] = useState<MateriStatus>('Draft')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const itemsPerPage = 10
  const totalPages = Math.ceil(items.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = items.slice(startIndex, endIndex)

  useEffect(() => {
    loadKelasDiampu()
    loadMateri()
  }, [])

  async function loadKelasDiampu() {
    try {
      // Coba ambil data guru untuk mendapatkan kelas_diampu
      const meResponse = await authAPI.me()
      console.log('Response dari authAPI.me():', meResponse)
      
      if (meResponse.success && meResponse.data) {
        // Handle nested user object atau direct data
        const userData = meResponse.data.user || meResponse.data
        const kelasData = userData.kelas_diampu || []
        console.log('kelas_diampu dari backend:', kelasData)
        
        // Check apakah kelas_diampu berisi object atau hanya ID
        if (Array.isArray(kelasData) && kelasData.length > 0) {
          // Jika berisi object dengan property nama/id (format baru dari backend)
          if (typeof kelasData[0] === 'object' && kelasData[0].nama) {
            console.log('Using kelas from backend with full details')
            setKelasList(kelasData)
            if (!kelas) setKelas(kelasData[0].id)
            return
          }
          
          // Jika berisi ID saja, coba load detail kelas dari backend
          if (typeof kelasData[0] === 'number' || typeof kelasData[0] === 'string') {
            try {
              const kelasResponse = await kelasAPI.getAll()
              if (kelasResponse.success) {
                const allKelas = kelasResponse.data?.data || kelasResponse.data || []
                const kelasDiampu = allKelas.filter((k: any) => 
                  kelasData.includes(k.id) || kelasData.includes(String(k.id)) || kelasData.includes(Number(k.id))
                )
                if (kelasDiampu.length > 0) {
                  console.log('Filtered kelas from full list:', kelasDiampu)
                  setKelasList(kelasDiampu)
                  if (!kelas) setKelas(kelasDiampu[0].id)
                  return
                }
              }
            } catch (err) {
              console.log('Cannot load kelas details (403), will use ID as name')
              // Fallback: buat object kelas dari ID saja
              const kelasFromIds = kelasData.map((id: any) => ({
                id: id,
                nama: `Kelas ${id}`,
                tingkat: String(id)
              }))
              setKelasList(kelasFromIds)
              if (!kelas) setKelas(kelasData[0])
              return
            }
          }
        }
      }
      
      // Final fallback: kelas manual X, XI, XII
      console.log('Using manual fallback kelas (no kelas_diampu found)')
      const manualKelas = [
        { id: 'X', nama: 'Kelas X', tingkat: 'X' },
        { id: 'XI', nama: 'Kelas XI', tingkat: 'XI' },
        { id: 'XII', nama: 'Kelas XII', tingkat: 'XII' }
      ]
      setKelasList(manualKelas as any)
      if (!kelas) setKelas('X')
      
    } catch (error: any) {
      console.error('Error loading kelas diampu:', error)
      // Fallback final
      const manualKelas = [
        { id: 'X', nama: 'Kelas X', tingkat: 'X' },
        { id: 'XI', nama: 'Kelas XI', tingkat: 'XI' },
        { id: 'XII', nama: 'Kelas XII', tingkat: 'XII' }
      ]
      setKelasList(manualKelas as any)
      if (!kelas) setKelas('X')
    }
  }

  async function loadMateri() {
    try {
      const response = await materiAPI.getAll()
      if (response.success && Array.isArray(response.data)) {
        setItems(response.data.sort((a: any, b: any) => 
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        ))
      }
    } catch (error) {
      console.error('Error loading materi:', error)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = useMemo(() => title.trim().length > 0 && !!pdfFile && !pdfError && !uploading, [title, pdfFile, pdfError, uploading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !pdfFile) return

    setUploading(true)
    try {
      const response = await materiAPI.create({
        judul: title.trim(),
        kelas: [kelas],
        status: status,
        file: pdfFile
      })
      if (response.success) {
        alert('Materi berhasil ditambahkan!')
        setTitle('')
        setStatus('Draft')
        setPdfFile(null)
        setPdfError(null)
        setShowForm(false)
        await loadMateri()
      }
    } catch (error: any) {
      console.error('Error creating materi:', error)
      alert(error.message || 'Gagal menambahkan materi')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string, judul: string) {
    if (confirm(`Hapus materi "${judul}"?`)) {
      try {
        const response = await materiAPI.delete(id)
        if (response.success) {
          await loadMateri()
          alert('Materi berhasil dihapus!')
        }
      } catch (error) {
        console.error('Error deleting materi:', error)
        alert('Gagal menghapus materi')
      }
    }
  }

  async function handleDownload(id: string) {
    try {
      await materiAPI.download(id)
    } catch (error) {
      console.error('Error downloading materi:', error)
      alert('Gagal mengunduh file')
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat data materi...</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-white p-4 sm:p-6 lg:p-7 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wide text-slate-500">MATERI</div>
          <h1 className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-800">Kelola materi</h1>
          <p className="mt-2 text-sm text-slate-600">Guru bisa menambahkan materi (PDF).</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600"
          >
            + Tambah Materi
          </button>
        )}
      </div>

      {showForm && (
        <form className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-3">
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

          <div className="mt-3 grid gap-3 md:grid-cols-3 md:items-end">
            <div className="md:col-span-2">
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

            <div className="md:col-span-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setTitle('')
                    setStatus('Draft')
                    setPdfFile(null)
                    setPdfError(null)
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
                  {uploading ? 'Mengunggah...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Judul</th>
              <th className="hidden sm:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Kelas</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Status</th>
              <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">File</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada materi. Klik "Tambah Materi" untuk membuat.
                </td>
              </tr>
            ) : (
              currentItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-800">{item.judul}</div>
                    <div className="mt-1 flex items-center gap-2 sm:hidden text-xs text-slate-500">
                      <span>{item.kelas}</span>
                      <span className="md:hidden">•</span>
                      <span className="md:hidden">{item.file_name || 'No file'}</span>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-center text-sm text-slate-600">{item.kelas}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        item.status === 'Dipublikasikan'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-center text-xs text-slate-500">
                    {item.file_name || 'No file'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 overflow-x-auto">
                      {item.file_path && (
                        <button
                          onClick={() => handleDownload(item.id)}
                          className="flex-shrink-0 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                        >
                          Download
                        </button>
                      )}
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
