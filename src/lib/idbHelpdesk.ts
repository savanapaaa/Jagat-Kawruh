// IndexedDB untuk Helpdesk/Support Tickets
const DB_NAME = 'HelpdeskDB'
const DB_VERSION = 1
const STORE_NAME = 'tickets'

export type TicketStatus = 'Open' | 'In Progress' | 'Resolved'
export type TicketKategori = 'Teknis' | 'Materi' | 'Nilai' | 'Lainnya'

export interface TicketBalasan {
  id: string
  dari: string // email pengirim
  namaUser: string
  pesan: string
  tanggal: string
}

export interface Ticket {
  id: string
  judul: string
  deskripsi: string
  kategori: TicketKategori
  status: TicketStatus
  pengirim: string // email siswa
  namaPengirim: string
  kelasPengirim?: string
  balasan: TicketBalasan[]
  createdAt: string
  updatedAt: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('pengirim', 'pengirim', { unique: false })
        store.createIndex('kategori', 'kategori', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
  })
}

export async function buatTicket(
  ticket: Omit<Ticket, 'id' | 'balasan' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const db = await openDB()
  const id = 'TKT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase()
  const now = new Date().toISOString()

  const newTicket: Ticket = {
    ...ticket,
    id,
    balasan: [],
    createdAt: now,
    updatedAt: now,
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.add(newTicket)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function semuaTicket(filterPengirim?: string): Promise<Ticket[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      let tickets = request.result as Ticket[]

      // Filter berdasarkan pengirim jika ada
      if (filterPengirim) {
        tickets = tickets.filter((t) => t.pengirim === filterPengirim)
      }

      // Urutkan dari terbaru
      tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      resolve(tickets)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function ticketById(id: string): Promise<Ticket | null> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(id)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function updateStatusTicket(id: string, status: TicketStatus): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(id)

    getRequest.onsuccess = () => {
      const ticket = getRequest.result as Ticket
      if (ticket) {
        ticket.status = status
        ticket.updatedAt = new Date().toISOString()

        const updateRequest = store.put(ticket)
        updateRequest.onsuccess = () => resolve()
        updateRequest.onerror = () => reject(updateRequest.error)
      } else {
        reject(new Error('Ticket not found'))
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })
}

export async function balasTicket(
  ticketId: string,
  balasan: Omit<TicketBalasan, 'id' | 'tanggal'>
): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(ticketId)

    getRequest.onsuccess = () => {
      const ticket = getRequest.result as Ticket
      if (ticket) {
        const newBalasan: TicketBalasan = {
          ...balasan,
          id: 'BLS-' + Date.now(),
          tanggal: new Date().toISOString(),
        }

        ticket.balasan.push(newBalasan)
        ticket.updatedAt = new Date().toISOString()

        const updateRequest = store.put(ticket)
        updateRequest.onsuccess = () => resolve()
        updateRequest.onerror = () => reject(updateRequest.error)
      } else {
        reject(new Error('Ticket not found'))
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })
}

export async function hapusTicket(id: string): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function hitungTicketOpen(): Promise<number> {
  const tickets = await semuaTicket()
  return tickets.filter((t) => t.status === 'Open').length
}
