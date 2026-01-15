import { useEffect, useState } from 'react'
import { getCurrentUser } from '../../lib/auth'
import {
  buatTicket,
  semuaTicket,
  balasTicket,
  type Ticket,
  type TicketKategori,
} from '../../lib/idbHelpdesk'

export default function SiswaHelpdesk() {
  const user = getCurrentUser()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null)

  // Form buat tiket baru
  const [judul, setJudul] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [kategori, setKategori] = useState<TicketKategori>('Teknis')

  // Form balas
  const [pesanBalas, setPesanBalas] = useState('')

  const loadTickets = async () => {
    setLoading(true)
    try {
      const data = await semuaTicket(user?.email)
      setTickets(data)
    } catch (error) {
      console.error('Error loading tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [user?.email])

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await buatTicket({
        judul: judul.trim(),
        deskripsi: deskripsi.trim(),
        kategori,
        status: 'Open',
        pengirim: user?.email || '',
        namaPengirim: user?.nama || 'Unknown',
        kelasPengirim: user?.kelas,
      })

      alert('Tiket berhasil dibuat!')
      setJudul('')
      setDeskripsi('')
      setKategori('Teknis')
      setShowForm(false)
      await loadTickets()
    } catch (error) {
      console.error('Error creating ticket:', error)
      alert('Gagal membuat tiket.')
    }
  }

  const handleBalas = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!viewingTicket) return

    try {
      await balasTicket(viewingTicket.id, {
        dari: user?.email || '',
        namaUser: user?.nama || 'Unknown',
        pesan: pesanBalas.trim(),
      })

      alert('Balasan terkirim!')
      setPesanBalas('')
      
      // Reload ticket yang sedang dilihat
      const updated = await semuaTicket(user?.email)
      const updatedTicket = updated.find((t) => t.id === viewingTicket.id)
      if (updatedTicket) {
        setViewingTicket(updatedTicket)
      }
      await loadTickets()
    } catch (error) {
      console.error('Error sending reply:', error)
      alert('Gagal mengirim balasan.')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-blue-100 text-blue-800'
      case 'In Progress':
        return 'bg-amber-100 text-amber-800'
      case 'Resolved':
        return 'bg-emerald-100 text-emerald-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  const getKategoriIcon = (kategori: string) => {
    switch (kategori) {
      case 'Teknis':
        return '⚙️'
      case 'Materi':
        return '📚'
      case 'Nilai':
        return '📊'
      default:
        return '💬'
    }
  }

  const formatWaktu = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Detail Ticket View
  if (viewingTicket) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <button
            onClick={() => setViewingTicket(null)}
            className="mb-4 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          >
            ← Kembali ke Daftar Tiket
          </button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getKategoriIcon(viewingTicket.kategori)}</span>
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-800">{viewingTicket.judul}</h1>
                  <p className="mt-1 text-sm text-slate-600">ID: {viewingTicket.id}</p>
                </div>
              </div>
            </div>
            <span className={`rounded-full px-4 py-2 text-xs font-semibold ${getStatusColor(viewingTicket.status)}`}>
              {viewingTicket.status}
            </span>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-5">
            <div className="text-xs font-semibold text-slate-500">DESKRIPSI MASALAH</div>
            <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{viewingTicket.deskripsi}</p>
            <div className="mt-3 text-xs text-slate-500">
              Dibuat: {formatWaktu(viewingTicket.createdAt)}
            </div>
          </div>
        </div>

        {/* Balasan */}
        <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-extrabold text-slate-800">
            Percakapan ({viewingTicket.balasan.length})
          </h2>

          <div className="mt-6 space-y-4">
            {viewingTicket.balasan.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-600">
                Belum ada balasan
              </div>
            ) : (
              viewingTicket.balasan.map((balasan) => (
                <div
                  key={balasan.id}
                  className={`rounded-2xl p-5 ${
                    balasan.dari === user?.email ? 'bg-emerald-50 ml-8' : 'bg-slate-50 mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-800">{balasan.namaUser}</div>
                    <div className="text-xs text-slate-500">{formatWaktu(balasan.tanggal)}</div>
                  </div>
                  <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{balasan.pesan}</p>
                </div>
              ))
            )}
          </div>

          {/* Form Balas */}
          {viewingTicket.status !== 'Resolved' && (
            <form onSubmit={handleBalas} className="mt-6">
              <label className="text-sm font-semibold text-slate-700">Balas Tiket</label>
              <textarea
                value={pesanBalas}
                onChange={(e) => setPesanBalas(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                rows={4}
                placeholder="Tulis balasan Anda..."
                required
              />
              <button
                type="submit"
                className="mt-3 rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                Kirim Balasan
              </button>
            </form>
          )}
        </div>
      </div>
    )
  }

  // List Tickets View
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex rounded-full bg-emerald-100 px-4 py-2 text-xs font-semibold text-emerald-800">
              🎧 Helpdesk
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
              Pusat Bantuan
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Butuh bantuan? Kirim tiket dan kami akan membantu Anda
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            {showForm ? '✕ Batal' : '+ Buat Tiket'}
          </button>
        </div>

        {/* Form Buat Tiket */}
        {showForm && (
          <form onSubmit={handleSubmitTicket} className="mt-6 space-y-4 rounded-2xl bg-slate-50 p-5">
            <div>
              <label className="text-sm font-semibold text-slate-700">Judul Masalah</label>
              <input
                type="text"
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                placeholder="Contoh: Tidak bisa akses materi kelas X"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Kategori</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value as TicketKategori)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
              >
                <option value="Teknis">⚙️ Teknis</option>
                <option value="Materi">📚 Materi</option>
                <option value="Nilai">📊 Nilai</option>
                <option value="Lainnya">💬 Lainnya</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Deskripsi Masalah</label>
              <textarea
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                rows={5}
                placeholder="Jelaskan masalah Anda secara detail..."
                required
              />
            </div>

            <button
              type="submit"
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              Kirim Tiket
            </button>
          </form>
        )}
      </div>

      {/* List Tiket */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-slate-200">
            <div className="text-slate-600">Memuat tiket...</div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-slate-200">
            <div className="text-slate-600">Belum ada tiket. Buat tiket baru untuk mendapatkan bantuan.</div>
          </div>
        ) : (
          tickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => setViewingTicket(ticket)}
              className="cursor-pointer rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-emerald-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{getKategoriIcon(ticket.kategori)}</div>
                  <div>
                    <h3 className="font-bold text-slate-800">{ticket.judul}</h3>
                    <p className="mt-1 text-sm text-slate-600 line-clamp-2">{ticket.deskripsi}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs text-slate-500">ID: {ticket.id}</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-500">{formatWaktu(ticket.createdAt)}</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-600 font-semibold">
                        {ticket.balasan.length} balasan
                      </span>
                    </div>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(ticket.status)}`}>
                  {ticket.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
