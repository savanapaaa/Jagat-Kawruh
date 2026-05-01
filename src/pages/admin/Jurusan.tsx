import { useEffect, useState } from 'react'
import { jurusanAPI, formatApiErrorAlert } from '../../lib/api'
import { Icon } from '../../components/ui/Icon'

type Jurusan = {
  id: string
  nama: string
  nama_jurusan?: string
  deskripsi?: string
}
 

export default function AdminJurusan() {
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingJurusan, setEditingJurusan] = useState<Jurusan | null>(null)
  
  const [formData, setFormData] = useState({
    nama: '',
    deskripsi: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const response = await jurusanAPI.getAll()
      if (response.success && response.data) {
        const sorted = response.data.sort((a: any, b: any) => 
          (a.nama || a.nama_jurusan || '').localeCompare(b.nama || b.nama_jurusan || '')
        )
        setJurusanList(sorted)
      }
    } catch (error) {
      console.error('Error loading jurusan:', error)
      alert('Gagal memuat data jurusan. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      const namaNormalized = String(formData.nama ?? '').trim().toUpperCase()
      const deskripsiNormalized = String(formData.deskripsi ?? '').trim()
      const deskripsiKey = deskripsiNormalized.replace(/\s+/g, ' ').toUpperCase()

      if (!namaNormalized) {
        alert('Nama jurusan wajib diisi. Silakan coba lagi.')
        return
      }

      // Nama jurusan di sini adalah singkatan (contoh: RPL, TKJ, MM), bukan nama kelas.
      // Jadi: tidak boleh ada spasi/angka.
      if (!/^[A-Z]+$/.test(namaNormalized)) {
        alert('Nama jurusan harus berupa singkatan tanpa spasi/angka (contoh: RPL, TKJ, MM, AKL).')
        return
      }

      const hasDuplicate = jurusanList.some((j) => {
        if (editingJurusan && String(j.id) === String(editingJurusan.id)) return false
        const existing = String(j.nama || j.nama_jurusan || '').trim().toUpperCase()
        return existing === namaNormalized
      })

      if (hasDuplicate) {
        alert(`Jurusan "${namaNormalized}" sudah ada. Gunakan singkatan lain.`)
        return
      }

      if (deskripsiKey.length > 0) {
        const hasDuplicateDeskripsi = jurusanList.some((j) => {
          if (editingJurusan && String(j.id) === String(editingJurusan.id)) return false
          const existingDesc = String(j.deskripsi ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
          return existingDesc.length > 0 && existingDesc === deskripsiKey
        })

        if (hasDuplicateDeskripsi) {
          alert(`Deskripsi jurusan "${deskripsiNormalized}" sudah ada. Gunakan deskripsi lain.`)
          return
        }
      }

      const payload = {
        nama: namaNormalized,
        deskripsi: deskripsiNormalized,
      }

      if (editingJurusan) {
        // Update
        await jurusanAPI.update(editingJurusan.id, payload)
        alert('Jurusan berhasil diperbarui!')
      } else {
        // Create
        await jurusanAPI.create(payload)
        alert('Jurusan berhasil ditambahkan!')
      }
      
      resetForm()
      await loadData()
    } catch (error) {
      console.error('Error saving jurusan:', error)
      alert(formatApiErrorAlert('Gagal menyimpan data jurusan.', error))
    }
  }

  function handleEdit(jurusan: Jurusan) {
    setEditingJurusan(jurusan)
    setFormData({
      nama: jurusan.nama || jurusan.nama_jurusan || '',
      deskripsi: jurusan.deskripsi || ''
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id: string, nama: string) {
    if (!confirm(`Hapus jurusan "${nama}"?`)) return
    
    try {
      await jurusanAPI.delete(id)
      alert('Jurusan berhasil dihapus!')
      await loadData()
    } catch (error) {
      console.error('Error deleting jurusan:', error)
      alert('Gagal menghapus jurusan. Silakan coba lagi.')
    }
  }

  function resetForm() {
    setFormData({
      nama: '',
      deskripsi: ''
    })
    setEditingJurusan(null)
    setShowForm(false)
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-4 sm:p-6 lg:p-7 shadow-sm ring-1 ring-slate-200">
        <div className="py-12 text-center text-slate-500">Memuat data...</div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-white p-4 sm:p-6 lg:p-7 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex rounded-full bg-purple-100 px-4 py-2 text-xs font-semibold text-purple-800">
            JURUSAN
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
            Kelola Jurusan
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Admin bisa menambahkan dan mengelola data jurusan.
          </p>
        </div>
        
        <button
          onClick={() => {
            if (showForm && !editingJurusan) {
              resetForm()
            } else if (editingJurusan) {
              resetForm()
            } else {
              setShowForm(true)
            }
          }}
          className="w-full shrink-0 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 sm:w-auto"
        >
          {showForm ? (
            <span className="inline-flex items-center gap-2">
              <Icon name="x" />
              Batal
            </span>
          ) : (
            '+ Tambah Jurusan'
          )}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-800">
            {editingJurusan ? (
              <span className="inline-flex items-center gap-2">
                <Icon name="pencil" />
                Edit Jurusan
              </span>
            ) : (
              'Tambah Jurusan Baru'
            )}
          </h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Nama Jurusan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.nama}
                onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                placeholder="Contoh: RPL, TKJ, MM, AKL"
                required
              />
              <p className="mt-1 text-xs text-slate-500">Singkatan jurusan</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">Deskripsi</label>
              <input
                type="text"
                value={formData.deskripsi}
                onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                placeholder="Nama lengkap jurusan (opsional)"
              />
              <p className="mt-1 text-xs text-slate-500">Contoh: Rekayasa Perangkat Lunak</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="w-full rounded-xl bg-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-300 sm:w-auto"
            >
              Batal
            </button>
            <button
              type="submit"
              className="w-full rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 sm:w-auto"
            >
              {editingJurusan ? 'Simpan Perubahan' : 'Tambah Jurusan'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Nama</th>
              <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Deskripsi</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jurusanList.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada data jurusan. Klik "Tambah Jurusan" untuk membuat.
                </td>
              </tr>
            ) : (
              jurusanList.map((jurusan) => {
                const namaJurusan = jurusan.nama || jurusan.nama_jurusan || ''
                
                return (
                  <tr key={jurusan.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-slate-800">{namaJurusan}</div>
                      <div className="mt-1 text-xs text-slate-500 sm:hidden">
                        {jurusan.deskripsi || '-'}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-sm text-slate-600">
                      {jurusan.deskripsi || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(jurusan)}
                          className="flex-shrink-0 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(jurusan.id, namaJurusan)}
                          className="flex-shrink-0 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {jurusanList.length > 0 && (
        <div className="mt-4 text-right text-sm text-slate-500">
          Total: {jurusanList.length} jurusan
        </div>
      )}
    </div>
  )
}
