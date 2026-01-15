import { useEffect, useState } from 'react'
import { nilaiAPI } from '../../lib/api'

export default function TeacherNilai() {
  const [nilai, setNilai] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterKelas, setFilterKelas] = useState('')

  useEffect(() => {
    loadNilai()
  }, [filterKelas])

  async function loadNilai() {
    try {
      const response = filterKelas 
        ? await nilaiAPI.getNilaiByKelas(filterKelas)
        : await nilaiAPI.getNilai()
      
      if (response.success && Array.isArray(response.data)) {
        setNilai(response.data)
      }
    } catch (error) {
      console.error('Error loading nilai:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat data nilai...</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold tracking-wide text-slate-500">NILAI</div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-800">Rekap nilai</h1>
          <p className="mt-2 text-sm text-slate-600">Nilai kuis siswa dari backend</p>
        </div>
        <select
          value={filterKelas}
          onChange={(e) => setFilterKelas(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-amber-400"
        >
          <option value="">Semua Kelas</option>
          <option value="X">X</option>
          <option value="XI">XI</option>
          <option value="XII">XII</option>
        </select>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full bg-white text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Nama</th>
              <th className="px-4 py-3 font-semibold">Kelas</th>
              <th className="px-4 py-3 font-semibold">Kuis</th>
              <th className="px-4 py-3 font-semibold">Nilai</th>
              <th className="px-4 py-3 font-semibold">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {nilai.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  Belum ada data nilai
                </td>
              </tr>
            ) : (
              nilai.map((n, idx) => (
                <tr key={idx} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-semibold text-slate-800">{n.nama_siswa || n.nama || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{n.kelas || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{n.judul_kuis || n.kuis || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{n.nilai || n.score || 0}</td>
                  <td className="px-4 py-3 text-slate-700 text-xs">
                    {n.created_at ? new Date(n.created_at).toLocaleDateString('id-ID') : '-'}
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
