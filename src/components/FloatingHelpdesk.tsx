import { useState, useEffect } from 'react'
import { getCurrentUser } from '../lib/auth'
import {
  buatTicket,
  semuaTicket,
  balasTicket,
  hitungTicketOpen,
  type Ticket,
  type TicketKategori,
} from '../lib/idbHelpdesk'

export default function FloatingHelpdesk() {
  const user = getCurrentUser()
  const [isOpen, setIsOpen] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [viewingTicket, setViewingTicket] = useState<Ticket | null>(null)
  const [openCount, setOpenCount] = useState(0)
  const [showNewTicketForm, setShowNewTicketForm] = useState(false)

  // Form buat tiket
  const [judul, setJudul] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [kategori, setKategori] = useState<TicketKategori>('Teknis')

  // Form balas
  const [pesanBalas, setPesanBalas] = useState('')

  const loadData = async () => {
    if (!user?.email) return
    
    try {
      const data = await semuaTicket(user.email)
      setTickets(data)
      
      const count = await hitungTicketOpen()
      setOpenCount(count)
    } catch (error) {
      console.error('Error loading helpdesk:', error)
    }
  }

  useEffect(() => {
    loadData()
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
      setShowNewTicketForm(false)
      await loadData()
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

      setPesanBalas('')
      
      const updated = await semuaTicket(user?.email)
      const updatedTicket = updated.find((t) => t.id === viewingTicket.id)
      if (updatedTicket) {
        setViewingTicket(updatedTicket)
      }
      await loadData()
    } catch (error) {
      console.error('Error sending reply:', error)
      alert('Gagal mengirim balasan.')
    }
  }

  const formatWaktu = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
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

  if (!user || user.role !== 'siswa') {
    return null // Hanya untuk siswa
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-600 hover:shadow-xl transition-all"
      >
        {isOpen ? (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
              {/* Headset band curve */}
              <path d="M12 2C7.589 2 4 5.589 4 10v2a2 2 0 00-2 2v3a2 2 0 002 2h1a1 1 0 001-1v-6a1 1 0 00-1-1 6 6 0 1112 0 1 1 0 00-1 1v6a1 1 0 001 1h1a2 2 0 002-2v-3a2 2 0 00-2-2v-2c0-4.411-3.589-8-8-8z"/>
              {/* Microphone */}
              <path d="M11 18h2v3a1 1 0 01-2 0v-3z"/>
              <rect x="10.5" y="20" width="3" height="2" rx="1"/>
            </svg>
            {openCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold">
                {openCount > 9 ? '9+' : openCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Floating Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-h-[600px] flex flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-emerald-500 px-5 py-4 text-white">
            <div>
              <h3 className="font-bold">🎧 Helpdesk</h3>
              <p className="text-xs opacity-90">Pusat Bantuan</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="rounded-lg p-1 hover:bg-emerald-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {viewingTicket ? (
              // Detail Ticket
              <div className="space-y-4">
                <button
                  onClick={() => setViewingTicket(null)}
                  className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  ← Kembali
                </button>

                <div>
                  <h4 className="font-bold text-slate-800">{viewingTicket.judul}</h4>
                  <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(viewingTicket.status)}`}>
                    {viewingTicket.status}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">{viewingTicket.deskripsi}</p>
                </div>

                {/* Balasan */}
                <div className="space-y-3">
                  {viewingTicket.balasan.map((balasan) => (
                    <div
                      key={balasan.id}
                      className={`rounded-xl p-3 ${
                        balasan.dari === user.email ? 'bg-emerald-50' : 'bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-800">{balasan.namaUser}</div>
                      <p className="mt-1 text-sm text-slate-700">{balasan.pesan}</p>
                      <div className="mt-1 text-xs text-slate-500">{formatWaktu(balasan.tanggal)}</div>
                    </div>
                  ))}
                </div>

                {/* Form Balas */}
                {viewingTicket.status !== 'Resolved' && (
                  <form onSubmit={handleBalas} className="space-y-2">
                    <textarea
                      value={pesanBalas}
                      onChange={(e) => setPesanBalas(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                      rows={3}
                      placeholder="Tulis balasan..."
                      required
                    />
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                    >
                      Kirim
                    </button>
                  </form>
                )}
              </div>
            ) : (
              // List Tickets atau Form Buat Tiket
              <div className="space-y-4">
                {tickets.length === 0 || showNewTicketForm ? (
                  // Form Buat Tiket
                  <form onSubmit={handleSubmitTicket} className="space-y-3">
                    {tickets.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowNewTicketForm(false)}
                        className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                      >
                        ← Kembali ke Daftar Tiket
                      </button>
                    )}
                    <p className="text-sm text-slate-600">Butuh bantuan? Buat tiket support</p>
                    
                    <input
                      type="text"
                      value={judul}
                      onChange={(e) => setJudul(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                      placeholder="Judul masalah"
                      required
                    />

                    <select
                      value={kategori}
                      onChange={(e) => setKategori(e.target.value as TicketKategori)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    >
                      <option value="Teknis">⚙️ Teknis</option>
                      <option value="Materi">📚 Materi</option>
                      <option value="Nilai">📊 Nilai</option>
                      <option value="Lainnya">💬 Lainnya</option>
                    </select>

                    <textarea
                      value={deskripsi}
                      onChange={(e) => setDeskripsi(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                      rows={4}
                      placeholder="Jelaskan masalah Anda..."
                      required
                    />

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                    >
                      Kirim Tiket
                    </button>
                  </form>
                ) : (
                  // List Tiket
                  <>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-800">Tiket Anda ({tickets.length})</h4>
                    </div>

                    <div className="space-y-2">
                      {tickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          onClick={() => setViewingTicket(ticket)}
                          className="cursor-pointer rounded-xl border border-slate-200 p-3 hover:border-emerald-300 hover:bg-emerald-50"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="text-sm font-bold text-slate-800">{ticket.judul}</h5>
                              <p className="mt-1 text-xs text-slate-600 line-clamp-1">{ticket.deskripsi}</p>
                            </div>
                            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(ticket.status)}`}>
                              {ticket.status}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            {ticket.balasan.length} balasan • {formatWaktu(ticket.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tombol Buat Tiket Baru */}
                    <button
                      onClick={() => {
                        setJudul('')
                        setDeskripsi('')
                        setKategori('Teknis')
                        setShowNewTicketForm(true)
                      }}
                      className="w-full rounded-xl border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-600"
                    >
                      + Buat Tiket Baru
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
