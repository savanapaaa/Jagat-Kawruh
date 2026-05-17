import { useCallback, useEffect, useState } from 'react'
import { guruAPI, jurusanAPI, kelasAPI, formatApiErrorAlert } from '../../lib/api'
import { Icon } from '../../components/ui/Icon'

function digitsOnly(value: string): string {
  return String(value ?? '').replace(/\D+/g, '')
}

type Guru = {
  id: string
  nip: string
  nama?: string
  name?: string  // Backend return 'name'
  email: string
  jurusan_id: string
  nama_jurusan?: string
  kelas_diampu?: string[]  // Array of kelas IDs
}

type Jurusan = {
  id: string
  nama: string
  nama_jurusan?: string
}

type Kelas = {
  id: string
  nama: string
  tingkat: string
  jurusan_id: string
}

export default function AdminGuru() {
  const [guruList, setGuruList] = useState<Guru[]>([])
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([])
  const [kelasList, setKelasList] = useState<Kelas[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingGuru, setEditingGuru] = useState<Guru | null>(null)
  
  const [formData, setFormData] = useState({
    nip: '',
    nama: '',
    email: '',
    password: '',
    kelas_diampu: [] as string[]
  })

  const loadJurusan = useCallback(async () => {
    try {
      const response = await jurusanAPI.getAll()
      if (response.success && response.data && Array.isArray(response.data)) {
        setJurusanList(response.data)
      }
    } catch (err) {
      console.error('Error loading jurusan:', err)
    }
  }, [])

  async function loadKelas() {
    try {
      const response = await kelasAPI.getAll()
      if (response.success) {
        const dataArray = response.data?.data || response.data
        if (Array.isArray(dataArray)) {
          setKelasList(dataArray)
        } else if (Array.isArray(response.data)) {
          setKelasList(response.data)
        }
      }
    } catch (err) {
      console.error('Error loading kelas:', err)
    }
  }

  async function loadData() {
    try {
      setLoading(true)
      
      // Pastikan jurusan sudah di-load
      let jurusanData = jurusanList
      if (jurusanData.length === 0) {
        const jurusanResponse = await jurusanAPI.getAll()
        if (jurusanResponse.success && jurusanResponse.data) {
          jurusanData = jurusanResponse.data
          setJurusanList(jurusanData)
        }
      }
      
      const response = await guruAPI.getAll()
      console.log('Response dari backend:', response)
      console.log('response.data:', response.data)
      console.log('jurusanData:', jurusanData)
      
      // Kemungkinan response.data adalah object dengan property 'data' (pagination)
      if (response.success) {
        // Cek apakah response.data.data (pagination Laravel)
        const dataArray = response.data?.data || response.data
        console.log('Data array:', dataArray)
        
        if (Array.isArray(dataArray)) {
          // Normalize: backend return 'name', frontend expect 'nama'
          const normalized = dataArray.map((g: any) => {
            // Mapping nama jurusan dari berbagai kemungkinan field
            let namaJurusan = g.nama_jurusan || g.jurusan?.nama || g.jurusan?.nama_jurusan || g.jurusan?.name || ''
            
            // Kalau masih kosong, cari dari jurusanData berdasarkan jurusan_id
            if (!namaJurusan && g.jurusan_id && jurusanData.length > 0) {
              const jurusan = jurusanData.find(j => String(j.id) === String(g.jurusan_id))
              namaJurusan = jurusan ? (jurusan.nama_jurusan || jurusan.nama) : ''
              console.log(`Mapping jurusan_id ${g.jurusan_id} -> ${namaJurusan}`)
            }
            
            return {
              ...g,
              nama: g.nama || g.name || '',
              nama_jurusan: namaJurusan,
              kelas_diampu: g.kelas_diampu || []
            }
          })
          console.log('Normalized guru list:', normalized)
          setGuruList(normalized)
        } else if (Array.isArray(response.data)) {
          const normalized = response.data.map((g: any) => {
            let namaJurusan = g.nama_jurusan || g.jurusan?.nama || g.jurusan?.nama_jurusan || g.jurusan?.name || ''
            
            if (!namaJurusan && g.jurusan_id && jurusanList.length > 0) {
              const jurusan = jurusanList.find(j => j.id === g.jurusan_id)
              namaJurusan = jurusan ? (jurusan.nama_jurusan || jurusan.nama) : ''
            }
            
            return {
              ...g,
              nama: g.nama || g.name || '',
              nama_jurusan: namaJurusan,
              kelas_diampu: g.kelas_diampu || []
            }
          })
          setGuruList(normalized)
        }
      }
    } catch (error) {
      console.error('Error loading guru:', error)
      alert('Gagal memuat data guru. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      await loadJurusan()
      await loadKelas()
      await loadData()
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const nipClean = digitsOnly(formData.nip)
    if (!nipClean) {
      alert('NIP wajib diisi dengan angka saja.')
      return
    }
    
    try {
      if (editingGuru) {
        // Update - Convert kelas_diampu to integers
        const updateData: {
          nip: string
          nama: string
          email: string
          kelas_diampu: number[]
          password?: string
        } = {
          nip: nipClean,
          nama: formData.nama,
          email: formData.email,
          kelas_diampu: formData.kelas_diampu.map(id => Number(id))
        }
        if (formData.password) {
          updateData.password = formData.password
        }
        console.log('Sending update data:', updateData)
        const response = await guruAPI.update(editingGuru.id, updateData)
        console.log('Update response:', response)
        alert('Guru berhasil diperbarui!')
        resetForm()
        // Reload jurusan and data untuk refresh nama jurusan
        await loadJurusan()
        await loadData()
      } else {
        // Create - Convert kelas_diampu to integers
        const createData = {
          nip: nipClean,
          nama: formData.nama,
          email: formData.email,
          password: formData.password,
          kelas_diampu: formData.kelas_diampu.map(id => Number(id))
        }
        console.log('Sending create data:', createData)
        const response = await guruAPI.create(createData)
        console.log('Create response:', response)
        alert('Guru berhasil ditambahkan!')
        resetForm()
        // Reload jurusan and data
        await loadJurusan()
        await loadData()
      }
    } catch (error) {
      console.error('Error saving guru:', error)
      alert(formatApiErrorAlert('Gagal menyimpan data guru.', error))
    }
  }

  function handleEdit(guru: Guru) {
    setEditingGuru(guru)
    setFormData({
      nip: digitsOnly(guru.nip),
      nama: guru.nama || guru.name || '',
      email: guru.email,
      password: '',
      kelas_diampu: guru.kelas_diampu || []
    })
    setShowForm(true)
  }

  async function handleDelete(id: string, nama: string) {
    if (!confirm(`Hapus guru "${nama}"?`)) return
    
    try {
      await guruAPI.delete(id)
      alert('Guru berhasil dihapus!')
      await loadData()
    } catch (error) {
      console.error('Error deleting guru:', error)
      alert('Gagal menghapus guru. Silakan coba lagi.')
    }
  }

  function resetForm() {
    setFormData({
      nip: '',
      nama: '',
      email: '',
      password: '',
      kelas_diampu: []
    })
    setEditingGuru(null)
    setShowForm(false)
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-4 sm:p-6 lg:p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat data guru...</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-white p-4 sm:p-6 lg:p-7 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex rounded-full bg-indigo-100 px-4 py-2 text-xs font-semibold text-indigo-800">
            GURU
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">Manajemen Guru</h1>
          <p className="mt-2 text-sm text-slate-600">Admin bisa menambahkan dan mengelola data guru.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            + Tambah Guru
          </button>
        )}
      </div>

      {showForm && (
        <form className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6" onSubmit={handleSubmit}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">
              {editingGuru ? 'Edit Guru' : 'Tambah Guru Baru'}
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Tutup"
            >
              <Icon name="x" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">NIP *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.nip}
                  onChange={(e) => setFormData({ ...formData, nip: digitsOnly(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                  placeholder="198501012010011001"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Nama Lengkap *</label>
                <input
                  type="text"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                  placeholder="Budi Santoso, S.Pd"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                  placeholder="guru@sekolah.com"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Password {editingGuru && '(Kosongkan jika tidak diubah)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                  placeholder="••••••••"
                  required={!editingGuru}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Kelas yang Diampu *
              </label>
              <div className="rounded-xl border border-slate-200 bg-white p-4 max-h-60 overflow-y-auto">
                {kelasList.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Belum ada kelas. Tambahkan kelas di menu Kelas terlebih dahulu.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {kelasList.map((kelas) => (
                      <label key={kelas.id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-lg">
                        <input
                          type="checkbox"
                          checked={formData.kelas_diampu.includes(kelas.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                kelas_diampu: [...formData.kelas_diampu, kelas.id]
                              })
                            } else {
                              setFormData({
                                ...formData,
                                kelas_diampu: formData.kelas_diampu.filter(id => id !== kelas.id)
                              })
                            }
                          }}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700">
                          {kelas.nama} <span className="text-slate-400">({kelas.tingkat})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Pilih kelas yang akan diajar oleh guru ini. Dipilih: {formData.kelas_diampu.length} kelas
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:justify-end">
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
                {editingGuru ? 'Simpan Perubahan' : 'Tambah Guru'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">NIP</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Nama</th>
              <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Email</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {guruList.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada data guru. Klik "Tambah Guru" untuk membuat.
                </td>
              </tr>
            ) : (
              guruList.map((guru) => (
                <tr key={guru.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {guru.nip}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-slate-800">{guru.nama}</div>
                    <div className="mt-1 text-xs text-slate-500 md:hidden">
                      <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {guru.email}
                      </span>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-sm text-slate-600">
                    <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      {guru.email}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 overflow-x-auto">
                      <button
                        onClick={() => handleEdit(guru)}
                        className="flex-shrink-0 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(guru.id, guru.nama || 'guru ini')}
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
    </div>
  )
}
