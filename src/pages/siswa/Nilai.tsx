import { useEffect, useState } from 'react'
import { nilaiAPI } from '../../lib/api'

type Attempt = {
  id: string
  kuis_id?: string
  judul_kuis?: string
  tanggal?: string
  nilai?: number
  score?: number
  benar?: number
  total_soal?: number
}

function loadFromLocalStorage(): Attempt[] {
  try {
    const raw = localStorage.getItem('jk_student_scores')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function Nilai() {
  const [items, setItems] = useState<Attempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadNilai()
  }, [])

  async function loadNilai() {
    try {
      setError(null)
      const response = await nilaiAPI.getNilai()
      if (response.success && Array.isArray(response.data)) {
        setItems(response.data)
      } else {
        setItems(loadFromLocalStorage())
      }
    } catch (error: any) {
      // Fallback tanpa log untuk console yang bersih
      setItems(loadFromLocalStorage())
      if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        setError('Menggunakan data lokal (backend belum siap)')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <p className="text-center text-slate-500">Memuat nilai...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="text-2xl font-extrabold tracking-tight text-slate-800">Nilai</div>
        <div className="mt-2 text-sm text-slate-600">Rekap nilai dari kuis yang sudah kamu kerjakan.</div>
        {error && (
          <div className="mt-2 text-xs text-amber-600">{error}</div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          Belum ada nilai. Kerjakan kuis terlebih dahulu.
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-6 py-4">Kuis</th>
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-slate-800">{s.judul_kuis || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {s.tanggal ? new Date(s.tanggal).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                        {s.nilai || s.score || 0}
                      </span>
                      {s.benar && s.total_soal && (
                        <span className="ml-2 text-xs text-slate-500">
                          ({s.benar}/{s.total_soal})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
