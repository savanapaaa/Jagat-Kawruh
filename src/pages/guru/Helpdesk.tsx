import { useEffect, useState } from 'react'
import { helpdeskAPI } from '../../lib/api'

type TicketStatus = 'Open' | 'In Progress' | 'Resolved'
type Ticket = any

export default function GuruHelpdesk() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null)
  const [filter, setFilter] = useState<'Semua' | 'Open' | 'In Progress' | 'Resolved'>('Semua')

  // Form balas
  const [pesanBalas, setPesanBalas] = useState('')

  const loadTickets = async () => {
    setLoading(true)
    try {
      const response = await helpdeskAPI.getAll()
      if (response.success && Array.isArray(response.data)) {
        setTickets(response.data)
      }
    } catch (error) {
      console.error('Error loading tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [])

  const handleUpdateStatus = async (ticketId: string, status: TicketStatus) => {
    try {
      const response = await helpdeskAPI.updateStatus(ticketId, { status })
      if (response.success) {
        alert(`Status diubah menjadi ${status}`)
        await loadTickets()
        
        // Update viewing ticket jika sedang dibuka
        if (viewingTicket && viewingTicket.id === ticketId) {
          const updated = await helpdeskAPI.getAll()
          if (updated.success && updated.data) {
            const updatedTicket = updated.data.find((t: any) => t.id === ticketId)
            if (updatedTicket) {
              setViewingTicket(updatedTicket)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Gagal mengubah status.')
    }
  }

  const handleBalas = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!viewingTicket) return

    try {
      const response = await helpdeskAPI.create({
        judul: `Re: ${viewingTicket.judul}`,
        pesan: pesanBalas.trim(),
        kategori: viewingTicket.kategori || 'Umum'
      })

      if (response.success) {
        alert('Balasan terkirim!')
        setPesanBalas('')

        const updated = await helpdeskAPI.getAll()
        if (updated.success && updated.data) {
          const updatedTicket = updated.data.find((t: any) => t.id === viewingTicket.id)
          if (updatedTicket) {
            setViewingTicket(updatedTicket)
          }
        }
        await loadTickets()
      }
    } catch (error) {
      console.error('Error sending reply:', error)
      alert('Gagal mengirim balasan.')
    }
  }

  const handleHapus = async (ticketId: string) => {
    if (confirm('Hapus tiket ini?')) {
      try {
        const response = await helpdeskAPI.delete(ticketId)
        if (response.success) {
          alert('Tiket berhasil dihapus!')
          setViewingTicket(null)
          await loadTickets()
        }
      } catch (error) {
        console.error('Error deleting ticket:', error)
        alert('Gagal menghapus tiket.')
      }
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

  const ticketsFiltered = (tickets || []).filter((t) => {
    if (filter === 'Semua') return true
    return t.status === filter
  })

  const openCount = (tickets || []).filter((t) => t.status === 'Open').length
  const inProgressCount = (tickets || []).filter((t) => t.status === 'In Progress').length

  // Detail Ticket View
  if (viewingTicket) {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <button
            onClick={() => setViewingTicket(null)}
            className="mb-4 text-sm font-semibold text-amber-600 hover:text-amber-700"
          >
            ← Kembali ke Daftar Tiket
          </button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getKategoriIcon(viewingTicket.kategori)}</span>
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-800">{viewingTicket.judul}</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Dari: {viewingTicket.namaPengirim} {viewingTicket.kelasPengirim && `(Kelas ${viewingTicket.kelasPengirim})`}
                  </p>
                  <p className="text-xs text-slate-500">ID: {viewingTicket.id}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={viewingTicket.status}
                onChange={(e) => handleUpdateStatus(viewingTicket.id, e.target.value as TicketStatus)}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold outline-none"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
              <button
                onClick={() => handleHapus(viewingTicket.id)}
                className="rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600"
              >
                Hapus
              </button>
            </div>
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
            Balasan Guru
          </h2>

          <div className="mt-6 space-y-4">
            {!viewingTicket.balasan || (typeof viewingTicket.balasan === 'string' && !viewingTicket.balasan.trim()) ? (
              <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-600">
                Belum ada balasan dari guru
              </div>
            ) : (
              <div className="rounded-2xl p-5 bg-amber-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-800">
                    Guru
                    <span className="ml-2 text-xs font-normal text-slate-500">(Admin/Guru)</span>
                  </div>
                  <div className="text-xs text-slate-500">{formatWaktu(viewingTicket.updated_at)}</div>
                </div>
                <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{viewingTicket.balasan}</p>
              </div>
            )}
          </div>

          {/* Form Balas */}
          <form onSubmit={handleBalas} className="mt-6">
            <label className="text-sm font-semibold text-slate-700">Balas Siswa</label>
            <textarea
              value={pesanBalas}
              onChange={(e) => setPesanBalas(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-amber-400"
              rows={4}
              placeholder="Tulis balasan untuk siswa..."
              required
            />
            <button
              type="submit"
              className="mt-3 rounded-full bg-amber-500 px-6 py-2 text-sm font-semibold text-white hover:bg-amber-600"
            >
              Kirim Balasan
            </button>
          </form>
        </div>
      </div>
    )
  }

  // List Tickets View
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800">
          🎧 Kelola Helpdesk
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800 sm:text-3xl">
          Kelola Tiket Bantuan
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {openCount} tiket baru • {inProgressCount} sedang diproses
        </p>

        {/* Filter */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setFilter('Semua')}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === 'Semua'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua ({tickets.length})
          </button>
          <button
            onClick={() => setFilter('Open')}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === 'Open'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Open ({openCount})
          </button>
          <button
            onClick={() => setFilter('In Progress')}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === 'In Progress'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            In Progress ({inProgressCount})
          </button>
          <button
            onClick={() => setFilter('Resolved')}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              filter === 'Resolved'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Resolved ({tickets.filter((t) => t.status === 'Resolved').length})
          </button>
        </div>
      </div>

      {/* List Tiket */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-slate-200">
            <div className="text-slate-600">Memuat tiket...</div>
          </div>
        ) : ticketsFiltered.length === 0 ? (
          <div className="rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-slate-200">
            <div className="text-slate-600">Tidak ada tiket {filter !== 'Semua' && `dengan status ${filter}`}</div>
          </div>
        ) : (
          ticketsFiltered.map((ticket) => (
            <div
              key={ticket.id}
              onClick={async () => {
                try {
                  // Get full ticket detail with balasan from backend
                  const response = await helpdeskAPI.getById(ticket.id)
                  console.log('Ticket detail response:', response)
                  
                  if (response.success && response.data) {
                    setViewingTicket(response.data)
                  } else {
                    // Fallback to list data
                    setViewingTicket(ticket)
                  }
                } catch (error) {
                  console.error('Error loading ticket detail:', error)
                  // Fallback to list data
                  setViewingTicket(ticket)
                }
              }}
              className="cursor-pointer rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-amber-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{getKategoriIcon(ticket.kategori)}</div>
                  <div>
                    <h3 className="font-bold text-slate-800">{ticket.judul}</h3>
                    <p className="mt-1 text-xs text-slate-600">
                      Dari: {ticket.namaPengirim} {ticket.kelasPengirim && `(Kelas ${ticket.kelasPengirim})`}
                    </p>
                    <p className="mt-2 text-sm text-slate-600 line-clamp-2">{ticket.deskripsi}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs text-slate-500">ID: {ticket.id}</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-500">{formatWaktu(ticket.createdAt)}</span>
                      {ticket.balasan && typeof ticket.balasan === 'string' && ticket.balasan.trim() && (
                        <>
                          <span className="text-xs text-slate-500">•</span>
                          <span className="text-xs text-green-600 font-semibold">
                            ✓ Sudah dibalas
                          </span>
                        </>
                      )}
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
