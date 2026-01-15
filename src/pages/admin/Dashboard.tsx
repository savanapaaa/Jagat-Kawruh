import { useEffect, useState } from 'react'
import { siswaAPI, jurusanAPI, guruAPI, kelasAPI } from '../../lib/api'

export default function AdminDashboard() {
  const [totalSiswa, setTotalSiswa] = useState(0)
  const [totalGuru, setTotalGuru] = useState(0)
  const [totalJurusan, setTotalJurusan] = useState(0)
  const [totalKelas, setTotalKelas] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const [siswaRes, guruRes, jurusanRes, kelasRes] = await Promise.all([
        siswaAPI.getAll(),
        guruAPI.getAll(),
        jurusanAPI.getAll(),
        kelasAPI.getAll()
      ])
      
      setTotalSiswa(siswaRes.data?.length || siswaRes.data?.data?.length || 0)
      setTotalGuru(guruRes.data?.length || guruRes.data?.data?.length || 0)
      setTotalJurusan(jurusanRes.data?.length || 0)
      setTotalKelas(kelasRes.data?.length || kelasRes.data?.data?.length || 0)
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="inline-flex rounded-full bg-blue-100 px-4 py-2 text-xs font-semibold text-blue-800">
          Dashboard Admin
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">Kontrol sistem</h1>
        <p className="mt-2 text-sm text-slate-600">
          Statistik data sistem dan informasi pengelolaan user, kelas, dan jurusan.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="text-xs font-semibold text-slate-500">Total Siswa</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-800">
            {loading ? '...' : totalSiswa}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="text-xs font-semibold text-slate-500">Total Guru</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-800">
            {loading ? '...' : totalGuru}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="text-xs font-semibold text-slate-500">Total Kelas</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-800">
            {loading ? '...' : totalKelas}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="text-xs font-semibold text-slate-500">Total Jurusan</div>
          <div className="mt-2 text-3xl font-extrabold text-slate-800">
            {loading ? '...' : totalJurusan}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="text-xs font-semibold text-slate-500">Status Sistem</div>
          <div className="mt-2 text-3xl font-extrabold text-green-600">OK</div>
        </div>
      </div>
    </div>
  )
}
