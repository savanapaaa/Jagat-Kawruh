import { useEffect, useState } from 'react'
import { siswaAPI, jurusanAPI } from '../../lib/api'
import { Icon } from '../../components/ui/Icon'

export default function Siswa() {
  const [daftarSiswa, setDaftarSiswa] = useState<any[]>([])
  const [daftarJurusan, setDaftarJurusan] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingSiswa, setEditingSiswa] = useState<any | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    nama: '',
    email: '',
    password: '',
    kelas: 'X',
    jurusan: ''
  })

  useEffect(() => {
    loadSiswa()
    loadJurusan()
  }, [])

  async function loadJurusan() {
    try {
      const response = await jurusanAPI.getAll()
      if (response.success && response.data) {
        const data = response.data.sort((a: any, b: any) => a.nama.localeCompare(b.nama))
        setDaftarJurusan(data)
        if (data.length > 0 && !formData.jurusan) {
          setFormData(prev => ({ ...prev, jurusan: data[0].id }))
        }
      }
    } catch (error) {
      console.error('Error loading jurusan:', error)
    }
  }

  async function loadSiswa() {
    try {
      const response = await siswaAPI.getAll()
      if (response.success && response.data) {
        setDaftarSiswa(response.data.sort((a: any, b: any) => a.nama.localeCompare(b.nama)))
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
      let response
      if (editingSiswa) {
        response = await siswaAPI.update(editingSiswa.id, {
          nama: formData.nama,
          email: formData.email,
          kelas_id: formData.kelas,
          jurusan_id: formData.jurusan
        })
      } else {
        response = await siswaAPI.create({
          nis: Date.now().toString(),
          nama: formData.nama,
          email: formData.email,
          password: formData.password,
          kelas_id: formData.kelas,
          jurusan_id: formData.jurusan
        })
      }
      
      if (response.success) {
        alert(editingSiswa ? 'Data siswa berhasil diubah!' : 'Akun siswa berhasil dibuat!')
        const defaultJurusan = daftarJurusan.length > 0 ? daftarJurusan[0].id : ''
        setFormData({ nama: '', email: '', password: '', kelas: 'X', jurusan: defaultJurusan })
        setShowForm(false)
        setEditingSiswa(null)
        await loadSiswa()
      }
    } catch (error: any) {
      console.error('Error saving siswa:', error)
      alert(error.message || 'Gagal menyimpan data. Silakan coba lagi.')
    }
  }

  function handleEdit(siswa: any) {
    setEditingSiswa(siswa)
    setFormData({
      nama: siswa.nama,
      email: siswa.email,
      password: siswa.password || '',
      kelas: siswa.kelas,
      jurusan: siswa.jurusan_id || siswa.jurusan
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelEdit() {
    const defaultJurusan = daftarJurusan.length > 0 ? daftarJurusan[0].id : ''
    setEditingSiswa(null)
    setFormData({ nama: '', email: '', password: '', kelas: 'X', jurusan: defaultJurusan })
    setShowForm(false)
  }

  async function handleDelete(id: string, nama: string) {
    if (confirm(`Hapus akun siswa "${nama}"?`)) {
      try {
        const response = await siswaAPI.delete(id)
        if (response.success) {
          await loadSiswa()
          alert('Akun siswa berhasil dihapus!')
        }
      } catch (error) {
        console.error('Error deleting siswa:', error)
        alert('Gagal menghapus siswa. Silakan coba lagi.')
      }
    }
  }

  const kelasOptions = ['X', 'XI', 'XII']

  // Group siswa by class
  const siswaByKelas = daftarSiswa.reduce((acc, siswa) => {
    if (!acc[siswa.kelas]) {
      acc[siswa.kelas] = []
    }
    acc[siswa.kelas].push(siswa)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Manajemen Siswa</h1>
        <p className="mt-1 text-sm text-slate-600">
          Buat dan atur akun siswa untuk masuk ke sistem
        </p>
      </div>

      {/* Tombol Tambah Siswa */}
      <div>
        <button
          onClick={() => {
            if (editingSiswa) {
              handleCancelEdit()
            } else {
              setShowForm(!showForm)
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
        >
          {showForm ? (
            <span className="inline-flex items-center gap-2">
              <Icon name="x" />
              Batal
            </span>
          ) : (
            <span>+ Tambah Siswa</span>
          )}
        </button>
      </div>

      {/* Form Tambah/Edit Siswa */}
      {showForm && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {editingSiswa ? (
              <span className="inline-flex items-center gap-2">
                <Icon name="pencil" />
                Edit Data Siswa
              </span>
            ) : (
              'Buat Akun Siswa Baru'
            )}
          </h2>
          
          <form onSubmit={handleSubmit} className="grid gap-4 max-w-2xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-700">Nama Lengkap</label>
                <input
                  type="text"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-amber-400"
                  placeholder="Nama siswa"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Kelas</label>
                <select
                  value={formData.kelas}
                  onChange={(e) => {
                    const value = e.target.value
                    let newJurusan = formData.jurusan
                    const kelasName = String(value || '').toUpperCase()
                    const matched = daftarJurusan.find(j => {
                      const jName = String(j.nama_jurusan || j.nama || '').toUpperCase()
                      if (kelasName.includes(jName)) return true
                      if (jName === 'REKAYASA PERANGKAT LUNAK' && kelasName.includes('RPL')) return true
                      if (jName === 'TEKNIK KOMPUTER DAN JARINGAN' && kelasName.includes('TKJ')) return true
                      if (jName === 'RPL' && kelasName.includes('RPL')) return true
                      if (jName === 'TKJ' && kelasName.includes('TKJ')) return true
                      return false
                    })
                    if (matched) {
                      newJurusan = matched.id
                    }
                    setFormData({ ...formData, kelas: value, jurusan: newJurusan })
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-amber-400"
                  required
                >
                  {kelasOptions.map((k) => (
                    <option key={k} value={k}>
                      Kelas {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Jurusan</label>
              <select
                value={formData.jurusan}
                onChange={(e) => setFormData({ ...formData, jurusan: e.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm outline-none cursor-not-allowed text-slate-500"
                required
                disabled={!!formData.kelas}
              >
                {daftarJurusan.length === 0 ? (
                  <option value="">Belum ada jurusan (tambahkan dulu di menu Jurusan)</option>
                ) : (
                  daftarJurusan.map((jur) => (
                    <option key={jur.id} value={jur.id}>
                      {jur.nama} {jur.deskripsi && `- ${jur.deskripsi}`}
                    </option>
                  ))
                )}
              </select>
              {!!formData.kelas && (
                <p className="mt-1 text-xs text-slate-500">Otomatis dipilih berdasarkan kelas (terkunci).</p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-amber-400"
                placeholder="email@siswa.com"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Password</label>
              <input
                type="text"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-amber-400"
                placeholder="Password untuk siswa"
                required
              />
              <p className="mt-1 text-xs text-slate-500">Password ini akan diberikan kepada siswa</p>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="submit"
                className="rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                {editingSiswa ? 'Simpan Perubahan' : 'Buat Akun'}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-xl bg-slate-100 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List Siswa */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Memuat data...</div>
      ) : daftarSiswa.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-slate-500">Belum ada siswa terdaftar.</p>
          <p className="mt-1 text-sm text-slate-400">Klik tombol "Tambah Siswa" untuk membuat akun.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {kelasOptions.map((kelas) => {
            const siswaKelas = siswaByKelas[kelas] || []
            if (siswaKelas.length === 0) return null

            return (
              <div key={kelas} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Kelas {kelas} ({siswaKelas.length} siswa)
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="pb-3 text-sm font-semibold text-slate-700">Nama</th>
                        <th className="pb-3 text-sm font-semibold text-slate-700">Jurusan</th>
                        <th className="pb-3 text-sm font-semibold text-slate-700">Email</th>
                        <th className="pb-3 text-sm font-semibold text-slate-700">Password</th>
                        <th className="pb-3 text-sm font-semibold text-slate-700 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {siswaKelas.map((siswa: any) => {
                        const jurusan = daftarJurusan.find(j => j.id === siswa.jurusan)
                        return (
                          <tr key={siswa.id} className="border-b border-slate-100">
                            <td className="py-3 text-sm text-slate-800">{siswa.nama}</td>
                            <td className="py-3 text-sm font-semibold text-amber-700">{jurusan?.nama || '-'}</td>
                            <td className="py-3 text-sm text-slate-600">{siswa.email}</td>
                            <td className="py-3 text-sm font-mono text-slate-600">{siswa.password}</td>
                            <td className="py-3 text-right">
                              <div className="flex justify-end gap-3">
                                <button
                                  onClick={() => handleEdit(siswa)}
                                  className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(siswa.id, siswa.nama)}
                                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                                >
                                  Hapus
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
