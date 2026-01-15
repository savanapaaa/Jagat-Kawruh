import { useEffect, useState } from 'react'
import { pblAPI } from '../../lib/api'

type PBLProject = {
  id: string
  judul: string
  masalah: string
  tujuan_pembelajaran: string
  panduan: string
  referensi?: string
  kelas: string
  status: string
  deadline: string
}

type Sintaks = {
  id: string
  urutan: number
  nama_fase: string
  deskripsi: string
  instruksi: string
}

export default function PBL() {
  const [projects, setProjects] = useState<PBLProject[]>([])
  const [selectedProject, setSelectedProject] = useState<PBLProject | null>(null)
  const [sintaksList, setSintaksList] = useState<Sintaks[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    try {
      const response = await pblAPI.getAll()
      if (response.success && Array.isArray(response.data)) {
        // Backend sudah filter otomatis berdasarkan kelas dan jurusan siswa
        setProjects(response.data)
      }
    } catch (error) {
      console.error('Error loading PBL projects:', error)
    } finally {
      setLoading(false)
    }
  }

  async function selectProject(project: PBLProject) {
    setSelectedProject(project)
    setActiveStep(0)
    
    try {
      const response = await pblAPI.getSintaks(project.id)
      if (response.success && Array.isArray(response.data)) {
        // Sintaks sudah terurut dari backend (by urutan ASC)
        setSintaksList(response.data)
      }
    } catch (error) {
      console.error('Error loading sintaks:', error)
      setSintaksList([])
    }
  }

  function getStepColor(index: number) {
    if (index === 0) return 'bg-red-500'
    if (index === 1) return 'bg-blue-500'
    if (index === 2) return 'bg-green-500'
    if (index === 3) return 'bg-yellow-500'
    if (index === 4) return 'bg-purple-500'
    return 'bg-slate-500'
  }

  function getBgColor(index: number) {
    if (index === 0) return 'bg-red-50'
    if (index === 1) return 'bg-blue-50'
    if (index === 2) return 'bg-green-50'
    if (index === 3) return 'bg-yellow-50'
    if (index === 4) return 'bg-purple-50'
    return 'bg-slate-50'
  }

  function getBorderColor(index: number) {
    if (index === 0) return 'border-red-500'
    if (index === 1) return 'border-blue-500'
    if (index === 2) return 'border-green-500'
    if (index === 3) return 'border-yellow-500'
    if (index === 4) return 'border-purple-500'
    return 'border-slate-500'
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-slate-600">Loading...</div>
      </div>
    )
  }

  // Detail Project View
  if (selectedProject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 p-6">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => {
              setSelectedProject(null)
              setSintaksList([])
              setActiveStep(0)
            }}
            className="mb-6 flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
          >
            ← Kembali ke Daftar Project
          </button>

          {/* Header Project */}
          <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
            <h1 className="text-3xl font-black text-slate-800">{selectedProject.judul}</h1>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div>
                <span className="font-semibold">Deadline:</span>{' '}
                {new Date(selectedProject.deadline).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </div>
            </div>
          </div>

          {/* Stepper - Sintaks PBL */}
          {sintaksList.length > 0 && (
            <div className="mb-8">
              <h2 className="mb-4 text-xl font-bold text-slate-800">Tahapan Pengerjaan</h2>
              <div className="flex items-center justify-between">
                {sintaksList.map((sintaks, index) => (
                  <div key={sintaks.id} className="flex flex-1 items-center">
                    <button
                      onClick={() => setActiveStep(index)}
                      className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full font-bold text-white transition ${
                        getStepColor(index)
                      } ${activeStep === index ? 'ring-4 ring-offset-2 scale-110' : 'opacity-70 hover:opacity-100'}`}
                    >
                      {index + 1}
                    </button>
                    {index < sintaksList.length - 1 && (
                      <div className="mx-2 h-1 flex-1 bg-slate-200 rounded" />
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs font-medium text-slate-600">
                {sintaksList.map((sintaks) => (
                  <div key={sintaks.id} className="flex-1 text-center">
                    {sintaks.nama_fase}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content Sintaks Aktif */}
          {sintaksList.length > 0 && sintaksList[activeStep] && (
            <div className={`rounded-2xl ${getBgColor(activeStep)} border-l-4 ${getBorderColor(activeStep)} p-8 shadow-lg`}>
              <div className="mb-4 flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${getStepColor(activeStep)} text-lg font-bold text-white`}>
                  {activeStep + 1}
                </span>
                <h3 className="text-2xl font-bold text-slate-800">{sintaksList[activeStep].nama_fase}</h3>
              </div>

              <div className="mb-6 rounded-lg bg-white p-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">Deskripsi:</p>
                <p className="text-slate-600 whitespace-pre-wrap">{sintaksList[activeStep].deskripsi}</p>
              </div>

              <div className="rounded-lg bg-white p-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">Instruksi:</p>
                <p className="text-slate-600 whitespace-pre-wrap">{sintaksList[activeStep].instruksi}</p>
              </div>

              {/* Navigation */}
              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                  disabled={activeStep === 0}
                  className="rounded-lg bg-slate-300 px-6 py-2 font-semibold text-slate-700 disabled:opacity-50 hover:bg-slate-400 transition"
                >
                  ← Sebelumnya
                </button>
                <button
                  onClick={() => setActiveStep(Math.min(sintaksList.length - 1, activeStep + 1))}
                  disabled={activeStep === sintaksList.length - 1}
                  className="rounded-lg bg-amber-500 px-6 py-2 font-semibold text-white disabled:opacity-50 hover:bg-amber-600 transition"
                >
                  Selanjutnya →
                </button>
              </div>
            </div>
          )}

          {/* Informasi Tambahan */}
          {selectedProject.referensi && (
            <div className="mt-8 rounded-2xl bg-white p-6 shadow-lg">
              <h3 className="mb-3 text-lg font-bold text-slate-800">Referensi</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedProject.referensi}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // List Projects View
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-slate-800">Problem-Based Learning</h1>
          <p className="mt-2 text-slate-600">Pilih project PBL untuk dikerjakan</p>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-lg">
            <p className="text-slate-600">Belum ada project PBL yang tersedia untuk Anda.</p>
            <p className="mt-2 text-sm text-slate-500">Project akan muncul sesuai kelas dan jurusan Anda</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg transition hover:shadow-xl cursor-pointer"
                onClick={() => selectProject(project)}
              >
                <h3 className="text-xl font-bold text-slate-800">{project.judul}</h3>
                <p className="mt-3 text-sm text-slate-600 line-clamp-3">{project.masalah}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>Kelas {project.kelas}</span>
                  <span>
                    Deadline: {new Date(project.deadline).toLocaleDateString('id-ID')}
                  </span>
                </div>
                <button className="mt-4 w-full rounded-lg bg-amber-500 py-2 font-semibold text-white transition hover:bg-amber-600">
                  Lihat Detail →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
