import { useEffect, useState } from 'react'
import { pblAPI, jurusanAPI, authAPI, kelasAPI, siswaAPI } from '../../lib/api'

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
  nama_fase?: string
  judul?: string
  deskripsi?: string
  instruksi: string
}

type Kelompok = {
  id: string
  nama_kelompok: string
  anggota_kelompok?: string | number[]  // Support both text and array
  anggota?: string[] | number[]  // Backend returns array of siswa IDs
  siswa?: Array<{ id: number; nama: string; nis?: string }>  // Populated by backend
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
  const [siswaList, setSiswaList] = useState<Array<{ id: number | string; nama: string; nis?: string; kelas?: string }>>([])
  const [expandedKelompok, setExpandedKelompok] = useState<string[]>([])

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

  const [kelompokFormData, setKelompokFormData] = useState<{
    nama_kelompok: string
    anggota_ids: number[]
  }>({
    nama_kelompok: '',
    anggota_ids: []
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
        // Handle nested user object atau direct data
        const userData = meResponse.data.user || meResponse.data
        const kelasData = userData.kelas_diampu || []
        
        if (Array.isArray(kelasData) && kelasData.length > 0) {
          // Jika berisi object dengan property nama/id (format baru dari backend)
          if (typeof kelasData[0] === 'object' && kelasData[0].nama) {
            setKelasList(kelasData)
            if (!formData.kelas) setFormData(prev => ({ ...prev, kelas: kelasData[0].id }))
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
                if (!formData.kelas) setFormData(prev => ({ ...prev, kelas: kelasDiampu[0].id }))
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
            if (!formData.kelas) setFormData(prev => ({ ...prev, kelas: kelasData[0] }))
            return
          }
        }
      }
      
      // Fallback: kelas manual
      const manualKelas = [
        { id: 'X', nama: 'Kelas X', tingkat: 'X' },
        { id: 'XI', nama: 'Kelas XI', tingkat: 'XI' },
        { id: 'XII', nama: 'Kelas XII', tingkat: 'XII' }
      ]
      setKelasList(manualKelas as any)
      if (!formData.kelas) setFormData(prev => ({ ...prev, kelas: 'X' }))
    } catch (error) {
      console.error('Error loading kelas diampu:', error)
      const manualKelas = [
        { id: 'X', nama: 'Kelas X', tingkat: 'X' },
        { id: 'XI', nama: 'Kelas XI', tingkat: 'XI' },
        { id: 'XII', nama: 'Kelas XII', tingkat: 'XII' }
      ]
      setKelasList(manualKelas as any)
      if (!formData.kelas) setFormData(prev => ({ ...prev, kelas: 'X' }))
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
      // Backend expect: judul, instruksi, urutan
      const dataToSend = {
        urutan: sintaksFormData.urutan,
        judul: sintaksFormData.nama_fase,  // Send as 'judul' to backend
        instruksi: sintaksFormData.instruksi
      }
      
      if (editingSintaks) {
        const response = await pblAPI.updateSintaks(selectedProject.id, editingSintaks.id, dataToSend)
        console.log('Update sintaks response:', response)
        alert('Sintaks berhasil diubah!')
      } else {
        const response = await pblAPI.createSintaks(selectedProject.id, dataToSend)
        console.log('Create sintaks response:', response)
        alert('Sintaks berhasil ditambahkan!')
      }
      resetSintaksForm()
      // Refresh sintaks list dari backend
      const refreshResponse = await pblAPI.getSintaks(selectedProject.id)
      console.log('Refreshed sintaks list:', refreshResponse)
      if (refreshResponse.success && Array.isArray(refreshResponse.data)) {
        setSintaksList(refreshResponse.data)
      }
    } catch (error) {
      console.error('Error saving sintaks:', error)
      alert('Gagal menyimpan sintaks.')
    }
  }

  function resetSintaksForm() {
    setSintaksFormData({
      urutan: (sintaksList.length || 0) + 1,
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
      nama_fase: sintaks.nama_fase || sintaks.judul || '',
      deskripsi: sintaks.deskripsi || '',
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
    
    // Load siswa untuk form
    try {
      const siswaResponse = await siswaAPI.getAll({ kelas: project.kelas })
      if (siswaResponse.success && Array.isArray(siswaResponse.data)) {
        setSiswaList(siswaResponse.data)
      }
    } catch (error) {
      console.error('Error loading siswa:', error)
    }
    
    // Load kelompok
    try {
      const response = await pblAPI.getKelompok(project.id)
      console.log('Kelompok response:', response)
      console.log('Kelompok data:', response.data)
      if (response.success && Array.isArray(response.data)) {
        console.log('Setting kelompok list:', response.data)
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
      // Convert IDs to siswa names for backend (temporary workaround)
      const selectedSiswa = siswaList.filter(s => kelompokFormData.anggota_ids.includes(s.id))
      const anggotaNamaList = selectedSiswa.map(s => s.nama).join('\n')
      
      const dataToSend: any = {
        nama_kelompok: kelompokFormData.nama_kelompok,
        anggota_kelompok: anggotaNamaList,  // Send as text for now
        anggota_ids: kelompokFormData.anggota_ids  // Also send IDs if backend supports
      }
      
      console.log('Sending kelompok data:', dataToSend)
      console.log('Selected siswa:', selectedSiswa)
      
      if (editingKelompok) {
        const response = await pblAPI.updateKelompok(selectedProject.id, editingKelompok.id, dataToSend)
        console.log('Update kelompok response:', response)
        alert('Kelompok berhasil diubah!')
      } else {
        const response = await pblAPI.createKelompok(selectedProject.id, dataToSend)
        console.log('Create kelompok response:', response)
        alert('Kelompok berhasil ditambahkan!')
      }
      resetKelompokForm()
      await viewKelompok(selectedProject)
    } catch (error: any) {
      console.error('Error saving kelompok:', error)
      console.error('Error detail:', error.message)
      alert('Gagal menyimpan kelompok: ' + (error.message || 'Unknown error'))
    }
  }

  function resetKelompokForm() {
    setKelompokFormData({
      nama_kelompok: '',
      anggota_ids: []
    })
    setShowKelompokForm(false)
    setEditingKelompok(null)
  }

  function handleEditKelompok(kelompok: Kelompok) {
    setEditingKelompok(kelompok)
    
    // Parse anggota_kelompok jadi array of IDs
    let anggotaIds: number[] = []
    if (Array.isArray(kelompok.anggota_kelompok)) {
      anggotaIds = kelompok.anggota_kelompok as number[]
    } else if (kelompok.siswa && Array.isArray(kelompok.siswa)) {
      anggotaIds = kelompok.siswa.map(s => s.id)
    }
    
    setKelompokFormData({
      nama_kelompok: kelompok.nama_kelompok,
      anggota_ids: anggotaIds
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
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Judul Fase *</label>
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
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Instruksi *</label>
                  <textarea
                    value={sintaksFormData.instruksi}
                    onChange={(e) => setSintaksFormData({ ...sintaksFormData, instruksi: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
                    rows={6}
                    placeholder="Jelaskan langkah-langkah yang harus dilakukan siswa pada fase ini...&#10;&#10;Contoh:&#10;1. Identifikasi masalah&#10;2. Buat hipotesis&#10;3. Diskusikan dengan kelompok"
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
                          <h3 className="text-xl font-bold text-slate-800">{sintaks.nama_fase || sintaks.judul}</h3>
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
                setKelompokFormData({ nama_kelompok: '', anggota_ids: [] })
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
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Pilih Anggota Kelompok *</label>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 max-h-80 overflow-y-auto">
                    {siswaList.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">
                        Tidak ada siswa di kelas ini
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {siswaList.map((siswa) => (
                          <label key={siswa.id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded-lg">
                            <input
                              type="checkbox"
                              checked={kelompokFormData.anggota_ids.includes(siswa.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setKelompokFormData({
                                    ...kelompokFormData,
                                    anggota_ids: [...kelompokFormData.anggota_ids, siswa.id]
                                  })
                                } else {
                                  setKelompokFormData({
                                    ...kelompokFormData,
                                    anggota_ids: kelompokFormData.anggota_ids.filter(id => id !== siswa.id)
                                  })
                                }
                              }}
                              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                            />
                            <div className="flex-1">
                              <span className="text-sm font-semibold text-slate-700">{siswa.nama}</span>
                              {siswa.nis && <span className="ml-2 text-xs text-slate-500">NIS: {siswa.nis}</span>}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Dipilih: {kelompokFormData.anggota_ids.length} siswa
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={kelompokFormData.anggota_ids.length === 0}
                  className="w-full rounded-lg bg-amber-500 py-3 font-bold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
              {kelompokList.map((kelompok) => {
                console.log('Rendering kelompok:', kelompok)
                console.log('kelompok.anggota:', kelompok.anggota)
                console.log('kelompok.siswa:', kelompok.siswa)
                console.log('kelompok.anggota_kelompok:', kelompok.anggota_kelompok)
                console.log('Available siswaList:', siswaList)
                
                const isExpanded = expandedKelompok.includes(kelompok.id)
                
                // Handle different response formats from backend
                let anggotaList: Array<{ nama: string; nis?: string }> = []
                
                if (kelompok.anggota && Array.isArray(kelompok.anggota)) {
                  // Backend returns array of siswa IDs like ["siswa-10", "siswa-8"]
                  console.log('Using anggota array (IDs)')
                  console.log('siswaList IDs available:', siswaList.map(s => s.id))
                  anggotaList = kelompok.anggota
                    .map(id => {
                      // ID could be string "siswa-10" or number 10
                      const idString = typeof id === 'string' ? id : `siswa-${id}`
                      const numericId = typeof id === 'string' && id.startsWith('siswa-') 
                        ? parseInt(id.replace('siswa-', ''))
                        : typeof id === 'number' ? id : null
                      
                      // Try to find by string ID first
                      let siswa = siswaList.find(s => String(s.id) === idString || s.id === id)
                      
                      // If not found and we have numeric ID, try that
                      if (!siswa && numericId) {
                        siswa = siswaList.find(s => s.id === numericId)
                      }
                      
                      console.log(`Looking for siswa ID ${id}:`, siswa)
                      
                      if (siswa) {
                        return siswa
                      } else {
                        // If not found in siswaList, create placeholder from ID
                        return { id: numericId || id, nama: `Siswa ${numericId || id}` }
                      }
                    })
                    .filter((s): s is { id: number | string; nama: string; nis?: string } => s !== null)
                } else if (kelompok.siswa && Array.isArray(kelompok.siswa)) {
                  // Backend populated with siswa objects
                  console.log('Using siswa array')
                  anggotaList = kelompok.siswa
                } else if (typeof kelompok.anggota_kelompok === 'string' && kelompok.anggota_kelompok.trim()) {
                  // Legacy: text format
                  console.log('Using text format, splitting:', kelompok.anggota_kelompok)
                  anggotaList = kelompok.anggota_kelompok.split('\n').filter(n => n.trim()).map(nama => ({ nama: nama.trim() }))
                }
                
                console.log('Final anggotaList:', anggotaList)
                
                return (
                  <div
                    key={kelompok.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">{kelompok.nama_kelompok}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {anggotaList.length} anggota
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedKelompok(expandedKelompok.filter(id => id !== kelompok.id))
                            } else {
                              setExpandedKelompok([...expandedKelompok, kelompok.id])
                            }
                          }}
                          className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600"
                        >
                          {isExpanded ? 'Tutup' : 'Detail'}
                        </button>
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
                    
                    {isExpanded && (
                      <div className="rounded-lg bg-slate-50 p-4 border-t border-slate-200">
                        <p className="mb-3 text-xs font-semibold text-slate-700">Daftar Anggota:</p>
                        {anggotaList.length > 0 ? (
                          <div className="space-y-1">
                            {anggotaList.map((anggota, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                                  {idx + 1}
                                </span>
                                <span>{anggota.nama}</span>
                                {anggota.nis && <span className="ml-auto text-xs text-slate-400">NIS: {anggota.nis}</span>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">Belum ada anggota</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
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
