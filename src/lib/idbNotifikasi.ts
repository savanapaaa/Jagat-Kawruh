// IndexedDB untuk Notifikasi
const DB_NAME = 'NotifikasiDB'
const DB_VERSION = 1
const STORE_NAME = 'notifikasi'

export interface Notifikasi {
  id: string
  judul: string
  pesan: string
  tipe: 'materi' | 'kuis' | 'pbl' | 'nilai' | 'info'
  dibaca: boolean
  createdAt: string
  targetSiswa?: string // Email siswa, jika kosong = untuk semua siswa
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
        store.createIndex('dibaca', 'dibaca', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
        store.createIndex('targetSiswa', 'targetSiswa', { unique: false })
      }
    }
  })
}

export async function tambahNotifikasi(notif: Omit<Notifikasi, 'id' | 'createdAt' | 'dibaca'>): Promise<void> {
  const db = await openDB()
  const id = 'NOTIF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
  const notifikasi: Notifikasi = {
    ...notif,
    id,
    dibaca: false,
    createdAt: new Date().toISOString(),
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.add(notifikasi)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function semuaNotifikasi(emailSiswa?: string): Promise<Notifikasi[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      let notifs = request.result as Notifikasi[]
      
      // Filter berdasarkan target siswa
      if (emailSiswa) {
        notifs = notifs.filter(n => !n.targetSiswa || n.targetSiswa === emailSiswa)
      }
      
      // Urutkan dari terbaru
      notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      
      resolve(notifs)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function hitungNotifikasiBelumDibaca(emailSiswa?: string): Promise<number> {
  const notifs = await semuaNotifikasi(emailSiswa)
  return notifs.filter(n => !n.dibaca).length
}

export async function tandaiBaca(id: string): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getRequest = store.get(id)

    getRequest.onsuccess = () => {
      const notif = getRequest.result as Notifikasi
      if (notif) {
        notif.dibaca = true
        const updateRequest = store.put(notif)
        updateRequest.onsuccess = () => resolve()
        updateRequest.onerror = () => reject(updateRequest.error)
      } else {
        resolve()
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })
}

export async function tandaiSemuaBaca(emailSiswa?: string): Promise<void> {
  const notifs = await semuaNotifikasi(emailSiswa)
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    let completed = 0
    const total = notifs.filter(n => !n.dibaca).length

    if (total === 0) {
      resolve()
      return
    }

    notifs.forEach((notif) => {
      if (!notif.dibaca) {
        notif.dibaca = true
        const request = store.put(notif)
        request.onsuccess = () => {
          completed++
          if (completed === total) resolve()
        }
        request.onerror = () => reject(request.error)
      }
    })
  })
}

export async function hapusNotifikasi(id: string): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
