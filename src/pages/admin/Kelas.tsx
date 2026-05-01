import { useCallback, useEffect, useState } from 'react'
import { kelasAPI, jurusanAPI, formatApiErrorAlert } from '../../lib/api'
import { Icon } from '../../components/ui/Icon'
import ResponsiveSelect from '../../components/ui/ResponsiveSelect'

type Kelas = {
  id: string
  nama: string
  tingkat: string
  jurusan_id: string
  nama_jurusan?: string
}

type Jurusan = {
  id: string
  nama: string
  nama_jurusan?: string
}

const TINGKAT_OPTIONS = ['X', 'XI', 'XII', 'VII', 'VIII', 'IX']

export default function AdminKelas() {
  const [kelasList, setKelasList] = useState<Kelas[]>([])
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingKelas, setEditingKelas] = useState<Kelas | null>(null)
  
  const [formData, setFormData] = useState({
    nama: '',
    tingkat: 'X',
    jurusan_id: ''
  })

  const loadJurusan = useCallback(async () => {
    try {
      const response = await jurusanAPI.getAll()
      if (response.success) {
        const dataArray = response.data?.data || response.data
        if (!Array.isArray(dataArray)) return
        setJurusanList(dataArray)
        if (dataArray.length > 0 && !formData.jurusan_id) {
          setFormData(prev => ({ ...prev, jurusan_id: dataArray[0].id }))
        }
      }
    } catch (err) {
      console.error('Error loading jurusan:', err)
    }
  }, [formData.jurusan_id])

  async function loadData() {
    try {
      setLoading(true)
      const response = await kelasAPI.getAll()
      
      if (response.success) {
        const dataArray = response.data?.data || response.data
        
        if (Array.isArray(dataArray)) {
          const normalized = dataArray.map((k: any) => {
            let namaJurusan = k.nama_jurusan || k.jurusan?.nama || k.jurusan?.nama_jurusan || k.jurusan?.name || ''
            
            if (!namaJurusan && k.jurusan_id && jurusanList.length > 0) {
              const jurusan = jurusanList.find(j => j.id === k.jurusan_id)
              namaJurusan = jurusan ? (jurusan.nama_jurusan || jurusan.nama) : ''
            }
            
            return {
              ...k,
              nama_jurusan: namaJurusan
            }
          })
          
          // Sort by tingkat then nama
          const sorted = normalized.sort((a, b) => {
            if (a.tingkat !== b.tingkat) {
              return TINGKAT_OPTIONS.indexOf(a.tingkat) - TINGKAT_OPTIONS.indexOf(b.tingkat)
            }
            return a.nama.localeCompare(b.nama)
          })
          
          setKelasList(sorted)
        } else if (Array.isArray(response.data)) {
          const normalized = response.data.map((k: any) => {
            let namaJurusan = k.nama_jurusan || k.jurusan?.nama || k.jurusan?.nama_jurusan || k.jurusan?.name || ''
            
            if (!namaJurusan && k.jurusan_id && jurusanList.length > 0) {
              const jurusan = jurusanList.find(j => j.id === k.jurusan_id)
              namaJurusan = jurusan ? (jurusan.nama_jurusan || jurusan.nama) : ''
            }
            
            return {
              ...k,
              nama_jurusan: namaJurusan
            }
          })
          
          const sorted = normalized.sort((a, b) => {
            if (a.tingkat !== b.tingkat) {
              return TINGKAT_OPTIONS.indexOf(a.tingkat) - TINGKAT_OPTIONS.indexOf(b.tingkat)
            }
            return a.nama.localeCompare(b.nama)
          })
          
          setKelasList(sorted)
        }
      }
    } catch (error) {
      console.error('Error loading kelas:', error)
      alert('Gagal memuat data kelas. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      await loadJurusan()
      await loadData()
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.tingkat || !formData.jurusan_id) {
      alert('Tingkat dan jurusan wajib dipilih.')
      return
    }

    const normalize = (v: unknown) =>
      String(v ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()

    const namaKey = normalize(formData.nama)
    const tingkatKey = normalize(formData.tingkat)
    const jurusanKey = normalize(formData.jurusan_id)

    const isDuplicate = kelasList.some((k) => {
      if (editingKelas && String(k.id) === String(editingKelas.id)) return false
      return normalize(k.nama) === namaKey && normalize(k.tingkat) === tingkatKey && normalize(k.jurusan_id) === jurusanKey
    })

    if (isDuplicate) {
      const jurusanName =
        jurusanList.find((j) => String(j.id) === String(formData.jurusan_id))?.nama_jurusan ||
        jurusanList.find((j) => String(j.id) === String(formData.jurusan_id))?.nama ||
        ''
      alert(
        'Gagal menyimpan data kelas.\n\n' +
          'Kelas dengan kombinasi berikut sudah ada:\n' +
          `- Nama: ${String(formData.nama).trim() || '-'}\n` +
          `- Tingkat: ${String(formData.tingkat).trim() || '-'}\n` +
          `- Jurusan: ${jurusanName || String(formData.jurusan_id)}\n\n` +
          'Silakan ubah data agar tidak duplikat.'
      )
      return
    }
    
    try {
      if (editingKelas) {
        await kelasAPI.update(editingKelas.id, formData)
        alert('Kelas berhasil diperbarui!')
      } else {
        await kelasAPI.create(formData)
        alert('Kelas berhasil ditambahkan!')
      }
      
      resetForm()
      await loadData()
    } catch (error) {
      console.error('Error saving kelas:', error)
      alert(formatApiErrorAlert('Gagal menyimpan data kelas.', error))
    }
  }

  function handleEdit(kelas: Kelas) {
    setEditingKelas(kelas)
    setFormData({
      nama: kelas.nama,
      tingkat: kelas.tingkat,
      jurusan_id: kelas.jurusan_id
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id: string, nama: string) {
    if (!confirm(`Hapus kelas "${nama}"?`)) return
    
    try {
      await kelasAPI.delete(id)
      alert('Kelas berhasil dihapus!')
      await loadData()
    } catch (error) {
      console.error('Error deleting kelas:', error)
      alert('Gagal menghapus kelas. Silakan coba lagi.')
    }
  }

  function resetForm() {
    setFormData({
      nama: '',
      tingkat: 'X',
      jurusan_id: jurusanList.length > 0 ? jurusanList[0].id : ''
    })
    setEditingKelas(null)
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
          <div className="inline-flex rounded-full bg-indigo-100 px-4 py-2 text-xs font-semibold text-indigo-800">
            KELAS
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
            Kelola Kelas
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Admin bisa menambahkan dan mengelola data kelas (contoh: X RPL 1, XI TKJ 2).
          </p>
        </div>
        
        <button
          onClick={() => {
            if (showForm && !editingKelas) {
              resetForm()
            } else if (editingKelas) {
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
            '+ Tambah Kelas'
          )}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-800">
            {editingKelas ? (
              <span className="inline-flex items-center gap-2">
                <Icon name="pencil" />
                Edit Kelas
              </span>
            ) : (
              'Tambah Kelas Baru'
            )}
          </h2>
          
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Nama Kelas <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.nama}
                onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                placeholder="Contoh: X RPL 1, XI TKJ 2"
                required
              />
              <p className="mt-1 text-xs text-slate-500">Format: Tingkat + Jurusan + Nomor</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Tingkat <span className="text-red-500">*</span>
              </label>
              <div className="mt-2">
                <ResponsiveSelect
                  value={formData.tingkat}
                  onChange={(value) => setFormData({ ...formData, tingkat: value })}
                  placeholder="Pilih Tingkat"
                  includeEmptyOption={false}
                  buttonClassName="focus:border-green-400 focus:ring-2 focus:ring-green-100"
                  options={TINGKAT_OPTIONS.map((t) => ({ value: t, label: t }))}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Pilih tingkat kelas</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Jurusan <span className="text-red-500">*</span>
              </label>
              <div className="mt-2">
                <ResponsiveSelect
                  value={formData.jurusan_id}
                  onChange={(value) => setFormData({ ...formData, jurusan_id: value })}
                  placeholder="Pilih Jurusan"
                  includeEmptyOption={false}
                  buttonClassName="focus:border-green-400 focus:ring-2 focus:ring-green-100"
                  options={jurusanList.map((jurusan) => ({
                    value: jurusan.id,
                    label: jurusan.nama_jurusan || jurusan.nama,
                  }))}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Pilih jurusan kelas</p>
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
              {editingKelas ? 'Simpan Perubahan' : 'Tambah Kelas'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Nama</th>
              <th className="hidden sm:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Tingkat</th>
              <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Jurusan</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {kelasList.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada data kelas. Klik "Tambah Kelas" untuk membuat.
                </td>
              </tr>
            ) : (
              kelasList.map((kelas) => (
                <tr key={kelas.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-slate-800">{kelas.nama}</div>
                    <div className="mt-1 flex flex-col gap-1 text-xs text-slate-500 sm:hidden">
                      <span>Tingkat: {kelas.tingkat}</span>
                      <span className="md:hidden">{kelas.nama_jurusan}</span>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-center">
                    <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {kelas.tingkat}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-center">
                    <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      {kelas.nama_jurusan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(kelas)}
                        className="flex-shrink-0 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(kelas.id, kelas.nama)}
                        className="flex-shrink-0 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
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

      {kelasList.length > 0 && (
        <div className="mt-4 text-right text-sm text-slate-500">
          Total: {kelasList.length} kelas
        </div>
      )}
    </div>
  )
}
