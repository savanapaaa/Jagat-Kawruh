import { useEffect, useState } from 'react'
import { siswaAPI, jurusanAPI } from '../../lib/api'

type Siswa = {
  id: string
  nis: string
  nama: string
  email: string
  kelas: string
  jurusan_id: string
  nama_jurusan?: string
}

type Jurusan = {
  id: string
  nama: string
  nama_jurusan?: string
}

export default function AdminSiswa() {
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSiswa, setEditingSiswa] = useState<Siswa | null>(null)
  
  const [formData, setFormData] = useState({
    nis: '',
    nama: '',
    email: '',
    password: '',
    kelas: 'X',
    jurusan_id: ''
  })

  const [filterKelas, setFilterKelas] = useState('')
  const [filterJurusan, setFilterJurusan] = useState('')

  useEffect(() => {
    const init = async () => {
      await loadJurusan()
      await loadData()
    }
    init()
  }, [filterKelas, filterJurusan])

  async function loadJurusan() {
    try {
      const response = await jurusanAPI.getAll()
      if (response.success && Array.isArray(response.data)) {
        setJurusanList(response.data)
        if (response.data.length > 0 && !formData.jurusan_id) {
          setFormData(prev => ({ ...prev, jurusan_id: response.data[0].id }))
        }
      }
    } catch (err) {
      console.error('Error loading jurusan:', err)
    }
  }

  async function loadData() {
    try {
      setLoading(true)
      const params: any = {}
      if (filterKelas) params.kelas = filterKelas
      if (filterJurusan) params.jurusan = filterJurusan
      
      const response = await siswaAPI.getAll(params)
      if (response.success && Array.isArray(response.data)) {
        // Normalize: mapping nama jurusan
        const normalized = response.data.map((s: any) => {
          // Mapping nama jurusan dari berbagai kemungkinan field
          let namaJurusan = s.nama_jurusan || s.jurusan?.nama || s.jurusan?.nama_jurusan || s.jurusan?.name || ''
          
          // Kalau masih kosong, cari dari jurusanList berdasarkan jurusan_id
          if (!namaJurusan && s.jurusan_id && jurusanList.length > 0) {
            const jurusan = jurusanList.find(j => j.id === s.jurusan_id)
            namaJurusan = jurusan ? (jurusan.nama_jurusan || jurusan.nama) : ''
          }
          
          return {
            ...s,
            nama_jurusan: namaJurusan
          }
        })
        setSiswaList(normalized)
      }
    } catch (error) {
      console.error('Error loading siswa:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      if (editingSiswa) {
        const updateData: any = {
          nis: formData.nis,
          nama: formData.nama,
          email: formData.email,
          kelas: formData.kelas,
          jurusan_id: formData.jurusan_id
        }
        await siswaAPI.update(editingSiswa.id, updateData)
        alert('Data siswa berhasil diubah!')
      } else {
        await siswaAPI.create(formData)
        alert('Siswa berhasil ditambahkan!')
      }
      
      resetForm()
      await loadData()
    } catch (error) {
      console.error('Error saving siswa:', error)
      alert('Gagal menyimpan data siswa.')
    }
  }

  function handleEdit(siswa: Siswa) {
    setEditingSiswa(siswa)
    setFormData({
      nis: siswa.nis,
      nama: siswa.nama,
      email: siswa.email,
      password: '',
      kelas: siswa.kelas,
      jurusan_id: siswa.jurusan_id
    })
    setShowForm(true)
  }

  async function handleDelete(id: string, nama: string) {
    if (!confirm(`Hapus siswa "${nama}"?`)) return
    
    try {
      await siswaAPI.delete(id)
      alert('Siswa berhasil dihapus!')
      await loadData()
    } catch (error) {
      console.error('Error deleting siswa:', error)
      alert('Gagal menghapus siswa.')
    }
  }

  function resetForm() {
    setFormData({
      nis: '',
      nama: '',
      email: '',
      password: '',
      kelas: 'X',
      jurusan_id: jurusanList.length > 0 ? jurusanList[0].id : ''
    })
    setEditingSiswa(null)
    setShowForm(false)
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-4 sm:p-6 lg:p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat data siswa...</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-white p-4 sm:p-6 lg:p-7 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wide text-slate-500">SISWA</div>
          <h1 className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-800">Kelola Siswa</h1>
          <p className="mt-2 text-sm text-slate-600">Admin bisa menambahkan dan mengelola data siswa.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600"
          >
            + Tambah Siswa
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="mt-6 flex flex-wrap gap-3">
        <select
          value={filterKelas}
          onChange={(e) => setFilterKelas(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-amber-400"
        >
          <option value="">Semua Kelas</option>
          <option value="X">Kelas X</option>
          <option value="XI">Kelas XI</option>
          <option value="XII">Kelas XII</option>
        </select>

        <select
          value={filterJurusan}
          onChange={(e) => setFilterJurusan(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-amber-400"
        >
          <option value="">Semua Jurusan</option>
          {jurusanList.map((j) => (
            <option key={j.id} value={j.id}>
              {j.nama_jurusan || j.nama}
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <form className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6" onSubmit={handleSubmit}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">
              {editingSiswa ? 'Edit Siswa' : 'Tambah Siswa Baru'}
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">NIS *</label>
                <input
                  type="text"
                  value={formData.nis}
                  onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                  placeholder="1234567890"
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
                  placeholder="Ahmad Budi"
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
                  placeholder="siswa@sekolah.com"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Password {editingSiswa && '(Kosongkan jika tidak diubah)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                  placeholder="••••••••"
                  required={!editingSiswa}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Kelas *</label>
                <select
                  value={formData.kelas}
                  onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                  required
                >
                  <option value="X">Kelas X</option>
                  <option value="XI">Kelas XI</option>
                  <option value="XII">Kelas XII</option>
                </select>
              </div>

              <div className="sm:col-span-1 lg:col-span-3">
                <label className="mb-2 block text-sm font-semibold text-slate-700">Jurusan *</label>
                <select
                  value={formData.jurusan_id}
                  onChange={(e) => setFormData({ ...formData, jurusan_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                  required
                >
                  <option value="">Pilih Jurusan</option>
                  {jurusanList.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nama_jurusan || j.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
              >
                {editingSiswa ? 'Simpan Perubahan' : 'Tambah Siswa'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">NIS</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Nama</th>
              <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Email</th>
              <th className="hidden sm:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Kelas</th>
              <th className="hidden lg:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Jurusan</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {siswaList.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada data siswa. Klik "Tambah Siswa" untuk membuat.
                </td>
              </tr>
            ) : (
              siswaList.map((siswa) => (
                <tr key={siswa.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-800">{siswa.nis}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-slate-800">{siswa.nama}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="md:hidden">{siswa.email}</span>
                      <span className="sm:hidden inline-block rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">
                        {siswa.kelas}
                      </span>
                      <span className="lg:hidden inline-block rounded-full bg-purple-100 px-2 py-0.5 text-purple-700">
                        {siswa.nama_jurusan}
                      </span>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-sm text-slate-600">
                    {siswa.email}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-center">
                    <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      {siswa.kelas}
                    </span>
                  </td>
                  <td className="hidden lg:table-cell px-4 py-3 text-center">
                    <span className="inline-block rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                      {siswa.nama_jurusan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 overflow-x-auto">
                      <button
                        onClick={() => handleEdit(siswa)}
                        className="flex-shrink-0 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(siswa.id, siswa.nama)}
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

      <div className="mt-4 text-sm text-slate-500">
        Total: <span className="font-semibold text-slate-800">{siswaList.length}</span> siswa
      </div>
    </div>
  )
}
