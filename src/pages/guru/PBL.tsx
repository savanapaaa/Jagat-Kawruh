import { useEffect, useState } from 'react'
import { pblAPI, jurusanAPI, authAPI, kelasAPI } from '../../lib/api'

type StatusPBL = 'Aktif' | 'Draft' | 'Selesai'

type ProjectPBL = {
  id: string
  judul: string
  masalah: string
  tujuan_pembelajaran: string
  panduan: string
  referensi?: string
  kelas: string
  jurusan_id: string
  status: StatusPBL
  deadline: string
}

type Jurusan = {
  id: string
  nama: string
  nama_jurusan?: string
}

type Sintaks = {
  id: string
  urutan: number
  nama_fase: string
  deskripsi: string
  instruksi: string
}

type Kelompok = {
  id: string
  nama_kelompok: string
  anggota_kelompok: string
}

type Kelas = {
  id: string
  nama: string
  tingkat: string
}

export default function PBL() {
  const [projects, setProjects] = useState<ProjectPBL[]>([])
  const [jurusanList, setJurusanList] = useState<Jurusan[]>([])
  const [kelasList, setKelasList] = useState<Kelas[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingProject, setEditingProject] = useState<ProjectPBL | null>(null)
  const [selectedProject, setSelectedProject] = useState<ProjectPBL | null>(null)
  const [sintaksList, setSintaksList] = useState<Sintaks[]>([])
  const [showSintaksForm, setShowSintaksForm] = useState(false)
  const [editingSintaks, setEditingSintaks] = useState<Sintaks | null>(null)
  const [viewMode, setViewMode] = useState<'sintaks' | 'kelompok' | null>(null)
  const [kelompokList, setKelompokList] = useState<Kelompok[]>([])
  const [showKelompokForm, setShowKelompokForm] = useState(false)
  const [editingKelompok, setEditingKelompok] = useState<Kelompok | null>(null)

  const [formData, setFormData] = useState({
    judul: '',
    masalah: '',
    tujuan_pembelajaran: '',
    panduan: '',
    referensi: '',
    kelas: '',
    jurusan_id: '',
    status: 'Draft' as StatusPBL,
    deadline: ''
  })

  const [sintaksFormData, setSintaksFormData] = useState({
    urutan: 1,
    nama_fase: '',
    deskripsi: '',
    instruksi: ''
  })

  const [kelompokFormData, setKelompokFormData] = useState({
    nama_kelompok: '',
    anggota_kelompok: ''
  })

  useEffect(() => {
    loadKelasDiampu()
    loadData()
    loadJurusan()
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
            if (kelasDiampu.length > 0 && !formData.kelas) {
              setFormData(prev => ({ ...prev, kelas: kelasDiampu[0].id }))
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading kelas diampu:', error)
    }
  }

  async function loadJurusan() {
    try {
      const response = await jurusanAPI.getAll()
      console.log('Jurusan response:', response)
      
      if (response.success && Array.isArray(response.data) && response.data.length > 0) {
        console.log('Jurusan list:', response.data)
        setJurusanList(response.data)
        // Set default jurusan jika formData.jurusan_id masih kosong
        if (!formData.jurusan_id) {
          setFormData(prev => ({ ...prev, jurusan_id: response.data![0].id }))
        }
      }
    } catch (err) {
      console.error('Error loading jurusan:', err)
    }
  }

  async function loadData() {
    try {
      const response = await pblAPI.getAll()
      if (response.success && Array.isArray(response.data)) {
        setProjects(response.data)
      }
    } catch (error) {
      console.error('Error loading PBL projects:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      const submitData = {
        ...formData,
        masalah: formData.masalah || '-',
        tujuan_pembelajaran: formData.tujuan_pembelajaran || '-',
        panduan: formData.panduan || '-',
        referensi: formData.referensi || ''
      }

      if (editingProject) {
        await pblAPI.update(editingProject.id, submitData)
        alert('Project PBL berhasil diubah!')
      } else {
        await pblAPI.create(submitData)
        alert('Project PBL berhasil dibuat!')
      }

      resetForm()
      await loadData()
    } catch (error) {
      console.error('Error saving project:', error)
      alert('Gagal menyimpan project PBL.')
    }
  }

  function resetForm() {
    const defaultJurusan = jurusanList.length > 0 ? jurusanList[0].id : ''
    setFormData({
      judul: '',
      masalah: '',
      tujuan_pembelajaran: '',
      panduan: '',
      referensi: '',
      kelas: 'X',
      jurusan_id: defaultJurusan,
      status: 'Draft',
      deadline: ''
    })
    setShowForm(false)
    setEditingProject(null)
  }

  function handleEdit(project: ProjectPBL) {
    setEditingProject(project)
    setFormData({
      judul: project.judul,
      masalah: project.masalah,
      tujuan_pembelajaran: project.tujuan_pembelajaran,
      panduan: project.panduan,
      referensi: project.referensi || '',
      kelas: project.kelas,
      jurusan_id: project.jurusan_id,
      status: project.status,
      deadline: project.deadline
    })
    setShowForm(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Yakin ingin menghapus project PBL ini?')) return
    
    try {
      await pblAPI.delete(id)
      alert('Project PBL berhasil dihapus!')
      await loadData()
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Gagal menghapus project PBL.')
    }
  }

  async function viewSintaks(project: ProjectPBL) {
    setSelectedProject(project)
    setViewMode('sintaks')
    try {
      const response = await pblAPI.getSintaks(project.id)
      if (response.success && Array.isArray(response.data)) {
        setSintaksList(response.data)
      }
    } catch (error) {
      console.error('Error loading sintaks:', error)
      setSintaksList([])
    }
  }

  async function handleSintaksSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProject) return

    try {
      if (editingSintaks) {
        await pblAPI.updateSintaks(selectedProject.id, editingSintaks.id, sintaksFormData)
        alert('Sintaks berhasil diubah!')
      } else {
        await pblAPI.createSintaks(selectedProject.id, sintaksFormData)
        alert('Sintaks berhasil ditambahkan!')
      }
      resetSintaksForm()
      await viewSintaks(selectedProject)
    } catch (error) {
      console.error('Error saving sintaks:', error)
      alert('Gagal menyimpan sintaks.')
    }
  }

  function resetSintaksForm() {
    setSintaksFormData({
      urutan: sintaksList.length + 1,
      nama_fase: '',
      deskripsi: '',
      instruksi: ''
    })
    setShowSintaksForm(false)
    setEditingSintaks(null)
  }

  function handleEditSintaks(sintaks: Sintaks) {
    setEditingSintaks(sintaks)
    setSintaksFormData({
      urutan: sintaks.urutan,
      nama_fase: sintaks.nama_fase,
      deskripsi: sintaks.deskripsi,
      instruksi: sintaks.instruksi
    })
    setShowSintaksForm(true)
  }

  async function handleDeleteSintaks(sintaksId: string) {
    if (!selectedProject) return
    if (!confirm('Yakin ingin menghapus sintaks ini?')) return

    try {
      await pblAPI.deleteSintaks(selectedProject.id, sintaksId)
      alert('Sintaks berhasil dihapus!')
      await viewSintaks(selectedProject)
    } catch (error) {
      console.error('Error deleting sintaks:', error)
      alert('Gagal menghapus sintaks.')
    }
  }

  async function viewKelompok(project: ProjectPBL) {
    setSelectedProject(project)
    setViewMode('kelompok')
    try {
      const response = await pblAPI.getKelompok(project.id)
      if (response.success && Array.isArray(response.data)) {
        setKelompokList(response.data)
      }
    } catch (error) {
      console.error('Error loading kelompok:', error)
      setKelompokList([])
    }
  }

  async function handleKelompokSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProject) return

    try {
      if (editingKelompok) {
        await pblAPI.updateKelompok(selectedProject.id, editingKelompok.id, kelompokFormData)
        alert('Kelompok berhasil diubah!')
      } else {
        await pblAPI.createKelompok(selectedProject.id, kelompokFormData)
        alert('Kelompok berhasil ditambahkan!')
      }
      resetKelompokForm()
      await viewKelompok(selectedProject)
    } catch (error) {
      console.error('Error saving kelompok:', error)
      alert('Gagal menyimpan kelompok.')
    }
  }

  function resetKelompokForm() {
    setKelompokFormData({
      nama_kelompok: '',
      anggota_kelompok: ''
    })
    setShowKelompokForm(false)
    setEditingKelompok(null)
  }

  function handleEditKelompok(kelompok: Kelompok) {
    setEditingKelompok(kelompok)
    setKelompokFormData({
      nama_kelompok: kelompok.nama_kelompok,
      anggota_kelompok: kelompok.anggota_kelompok
    })
    setShowKelompokForm(true)
  }

  async function handleDeleteKelompok(kelompokId: string) {
    if (!selectedProject) return
    if (!confirm('Yakin ingin menghapus kelompok ini?')) return

    try {
      await pblAPI.deleteKelompok(selectedProject.id, kelompokId)
      alert('Kelompok berhasil dihapus!')
      await viewKelompok(selectedProject)
    } catch (error) {
      console.error('Error deleting kelompok:', error)
      alert('Gagal menghapus kelompok.')
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-slate-600">Loading...</div>
      </div>
    )
  }

  // Detail Sintaks View
  if (selectedProject && viewMode === 'sintaks') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 p-6">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => {
              setSelectedProject(null)
              setSintaksList([])
              resetSintaksForm()
              setViewMode(null)
            }}
            className="mb-6 flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
          >
            ← Kembali ke Daftar Project
          </button>

          <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
            <h1 className="text-3xl font-black text-slate-800">{selectedProject.judul}</h1>
            <p className="mt-2 text-sm text-slate-600">Kelola sintaks pembelajaran untuk project ini</p>
          </div>

          <div className="mb-6 flex justify-end">
            <button
              onClick={() => {
                setSintaksFormData({ urutan: sintaksList.length + 1, nama_fase: '', deskripsi: '', instruksi: '' })
                setShowSintaksForm(!showSintaksForm)
              }}
              className="rounded-xl bg-amber-500 px-5 py-2.5 font-bold text-white shadow-md hover:bg-amber-600"
            >
              {showSintaksForm ? '✕ Tutup Form' : '+ Tambah Sintaks'}
            </button>
          </div>

          {showSintaksForm && (
            <div className="mb-8 rounded-2xl border-2 border-amber-300 bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-bold text-slate-800">
                {editingSintaks ? 'Edit Sintaks' : 'Tambah Sintaks Baru'}
              </h2>
              <form onSubmit={handleSintaksSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Urutan *</label>
                  <input
                    type="number"
                    min="1"
                    value={sintaksFormData.urutan}
                    onChange={(e) => setSintaksFormData({ ...sintaksFormData, urutan: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Nama Fase *</label>
                  <input
                    type="text"
                    value={sintaksFormData.nama_fase}
                    onChange={(e) => setSintaksFormData({ ...sintaksFormData, nama_fase: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500"
                    placeholder="Orientasi Masalah"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Deskripsi *</label>
                  <textarea
                    value={sintaksFormData.deskripsi}
                    onChange={(e) => setSintaksFormData({ ...sintaksFormData, deskripsi: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
                    rows={3}
                    placeholder="Jelaskan tujuan fase ini..."
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Instruksi *</label>
                  <textarea
                    value={sintaksFormData.instruksi}
                    onChange={(e) => setSintaksFormData({ ...sintaksFormData, instruksi: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
                    rows={4}
                    placeholder="Langkah-langkah yang harus dilakukan siswa..."
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-amber-500 py-3 font-bold text-white hover:bg-amber-600"
                >
                  {editingSintaks ? 'Simpan Perubahan' : 'Tambah Sintaks'}
                </button>
              </form>
            </div>
          )}

          {sintaksList.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center">
              <p className="text-slate-600">Belum ada sintaks untuk project ini.</p>
              <p className="mt-2 text-sm text-slate-500">Klik "Tambah Sintaks" untuk mulai membuat tahapan</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sintaksList.map((sintaks, index) => {
                const getColor = (idx: number) => {
                  const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'pink']
                  return colors[idx % colors.length]
                }
                const color = getColor(index)
                
                return (
                  <div
                    key={sintaks.id}
                    className={`rounded-2xl bg-${color}-50 border-l-4 border-${color}-500 p-6 shadow-md`}
                    style={{
                      backgroundColor: index === 0 ? '#fef2f2' : index === 1 ? '#eff6ff' : index === 2 ? '#f0fdf4' : index === 3 ? '#fefce8' : index === 4 ? '#faf5ff' : '#fdf4ff',
                      borderLeftColor: index === 0 ? '#ef4444' : index === 1 ? '#3b82f6' : index === 2 ? '#22c55e' : index === 3 ? '#eab308' : index === 4 ? '#a855f7' : '#ec4899'
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span 
                            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
                            style={{
                              backgroundColor: index === 0 ? '#ef4444' : index === 1 ? '#3b82f6' : index === 2 ? '#22c55e' : index === 3 ? '#eab308' : index === 4 ? '#a855f7' : '#ec4899'
                            }}
                          >
                            {sintaks.urutan}
                          </span>
                          <h3 className="text-xl font-bold text-slate-800">{sintaks.nama_fase}</h3>
                        </div>
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-slate-700 mb-1">Deskripsi:</p>
                          <p className="text-sm text-slate-600 whitespace-pre-wrap">{sintaks.deskripsi}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-700 mb-1">Instruksi:</p>
                          <p className="text-sm text-slate-600 whitespace-pre-wrap">{sintaks.instruksi}</p>
                        </div>
                      </div>
                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => handleEditSintaks(sintaks)}
                          className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSintaks(sintaks.id)}
                          className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Detail Kelompok View
  if (selectedProject && viewMode === 'kelompok') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 p-6">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => {
              setSelectedProject(null)
              setKelompokList([])
              resetKelompokForm()
              setViewMode(null)
            }}
            className="mb-6 flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
          >
            ← Kembali ke Daftar Project
          </button>

          <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
            <h1 className="text-3xl font-black text-slate-800">{selectedProject.judul}</h1>
            <p className="mt-2 text-sm text-slate-600">Kelola kelompok siswa untuk project ini</p>
          </div>

          <div className="mb-6 flex justify-end">
            <button
              onClick={() => {
                setKelompokFormData({ nama_kelompok: '', anggota_kelompok: '' })
                setShowKelompokForm(!showKelompokForm)
              }}
              className="rounded-xl bg-amber-500 px-5 py-2.5 font-bold text-white shadow-md hover:bg-amber-600"
            >
              {showKelompokForm ? '✕ Tutup Form' : '+ Tambah Kelompok'}
            </button>
          </div>

          {showKelompokForm && (
            <div className="mb-8 rounded-2xl border-2 border-amber-300 bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-xl font-bold text-slate-800">
                {editingKelompok ? 'Edit Kelompok' : 'Tambah Kelompok Baru'}
              </h2>
              <form onSubmit={handleKelompokSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Nama Kelompok *</label>
                  <input
                    type="text"
                    value={kelompokFormData.nama_kelompok}
                    onChange={(e) => setKelompokFormData({ ...kelompokFormData, nama_kelompok: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-amber-500"
                    placeholder="Kelompok 1"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Anggota Kelompok *</label>
                  <textarea
                    value={kelompokFormData.anggota_kelompok}
                    onChange={(e) => setKelompokFormData({ ...kelompokFormData, anggota_kelompok: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
                    rows={4}
                    placeholder="Masukkan nama siswa (satu per baris)&#10;Budi Santoso&#10;Ani Wijaya&#10;Citra Dewi"
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">Tulis nama siswa, satu nama per baris</p>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-amber-500 py-3 font-bold text-white hover:bg-amber-600"
                >
                  {editingKelompok ? 'Simpan Perubahan' : 'Tambah Kelompok'}
                </button>
              </form>
            </div>
          )}

          {kelompokList.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center">
              <p className="text-slate-600">Belum ada kelompok untuk project ini.</p>
              <p className="mt-2 text-sm text-slate-500">Klik "Tambah Kelompok" untuk mulai membuat kelompok</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {kelompokList.map((kelompok) => (
                <div
                  key={kelompok.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <h3 className="text-xl font-bold text-slate-800">{kelompok.nama_kelompok}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditKelompok(kelompok)}
                        className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteKelompok(kelompok.id)}
                        className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <p className="mb-2 text-xs font-semibold text-slate-700">Anggota:</p>
                    <div className="space-y-1">
                      {kelompok.anggota_kelompok.split('\n').map((nama, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                            {idx + 1}
                          </span>
                          {nama.trim()}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Main Project List View
  return (
    <div className="rounded-3xl bg-white p-4 sm:p-6 lg:p-7 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wide text-slate-500">PBL</div>
          <h1 className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-800">Problem-Based Learning</h1>
          <p className="mt-2 text-sm text-slate-600">Guru bisa menambahkan project PBL dan mengelola sintaks pembelajaran.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600"
          >
            + Tambah Project PBL
          </button>
        )}
      </div>

      {showForm && (
        <form className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6" onSubmit={handleSubmit}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">
              {editingProject ? 'Edit Project PBL' : 'Buat Project PBL Baru'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                resetForm()
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
          <div className="space-y-6">
              {/* Info Dasar */}
              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Judul Project *</label>
                  <input
                    type="text"
                    value={formData.judul}
                    onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                    placeholder="Contoh: Sistem Informasi Perpustakaan"
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Kelas *</label>
                    <select
                      value={formData.kelas}
                      onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
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
                        Anda belum diamanahi kelas. Hubungi admin.
                      </p>
                    )}
                  </div>
                  <div>
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
                          {j.nama_jurusan || j.nama || 'Jurusan'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Status *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as StatusPBL })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                      required
                    >
                      <option value="Draft">Draft</option>
                      <option value="Aktif">Aktif</option>
                      <option value="Selesai">Selesai</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Deadline *</label>
                    <input
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
                >
                  {editingProject ? 'Simpan Perubahan' : 'Buat Project PBL'}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Project</th>
                <th className="hidden sm:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Kelas</th>
                <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Deadline</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Status</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Belum ada project PBL. Klik "Tambah Project PBL" untuk membuat.
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-slate-800">{project.judul}</div>
                      <div className="mt-1 text-xs text-slate-500 line-clamp-1">{project.masalah}</div>
                      <div className="mt-1 flex items-center gap-2 sm:hidden">
                        <span className="text-xs text-slate-600">{project.kelas}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">
                          {new Date(project.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-center text-sm text-slate-600">
                      {project.kelas}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-center text-xs text-slate-500">
                      {new Date(project.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                        project.status === 'Aktif' ? 'bg-green-100 text-green-700' :
                        project.status === 'Draft' ? 'bg-slate-100 text-slate-600' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {/* Mobile: Icon button with labels and scroll */}
                      <div className="flex items-center justify-end gap-2 overflow-x-auto md:hidden">
                        <button
                          onClick={() => {
                            setViewMode('sintaks')
                            viewSintaks(project)
                          }}
                          className="flex flex-col items-center gap-1 rounded-lg bg-purple-500 px-3 py-2 text-white hover:bg-purple-600 flex-shrink-0"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <span className="text-[10px] font-semibold">Sintaks</span>
                        </button>
                        <button
                          onClick={() => viewKelompok(project)}
                          className="flex flex-col items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-white hover:bg-amber-600 flex-shrink-0"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span className="text-[10px] font-semibold">Kelompok</span>
                        </button>
                        <button
                          onClick={() => handleEdit(project)}
                          className="flex flex-col items-center gap-1 rounded-lg bg-blue-500 px-3 py-2 text-white hover:bg-blue-600 flex-shrink-0"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span className="text-[10px] font-semibold">Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="flex flex-col items-center gap-1 rounded-lg bg-red-500 px-3 py-2 text-white hover:bg-red-600 flex-shrink-0"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="text-[10px] font-semibold">Hapus</span>
                        </button>
                      </div>
                      {/* Desktop: Text buttons */}
                      <div className="hidden md:flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setViewMode('sintaks')
                            viewSintaks(project)
                          }}
                          className="rounded-lg bg-purple-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-600"
                        >
                          Sintaks
                        </button>
                        <button
                          onClick={() => viewKelompok(project)}
                          className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                        >
                          Kelompok
                        </button>
                        <button
                          onClick={() => handleEdit(project)}
                          className="rounded-lg bg-blue-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
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
