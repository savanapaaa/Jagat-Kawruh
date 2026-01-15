// IndexedDB untuk data siswa

export type Siswa = {
  id: string
  email: string
  password: string
  nama: string
  kelas: string // X, XI, XII
  jurusan: string // ID jurusan
  createdAt: string
  createdBy: string // email guru/admin yang membuat
}

const DB_NAME = 'JagatKawruhDB'
const STORE_NAME = 'siswa'
const DB_VERSION = 10

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create siswa store if not exists
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('email', 'email', { unique: true })
        store.createIndex('kelas', 'kelas', { unique: false })
      }
    }
  })
}

// CREATE: Tambah siswa baru
export async function tambahSiswa(siswa: Omit<Siswa, 'id' | 'createdAt'>): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  const siswaBaru: Siswa = {
    ...siswa,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  }

  return new Promise((resolve, reject) => {
    const request = store.add(siswaBaru)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// READ: Get all siswa
export async function semuaSiswa(): Promise<Siswa[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// READ: Get siswa by email
export async function siswaByEmail(email: string): Promise<Siswa | null> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const index = store.index('email')

  return new Promise((resolve, reject) => {
    const request = index.get(email)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

// READ: Get siswa by class
export async function siswaByKelas(kelas: string): Promise<Siswa[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const index = store.index('kelas')

  return new Promise((resolve, reject) => {
    const request = index.getAll(kelas)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// UPDATE: Update siswa
export async function updateSiswa(id: string, updates: Partial<Omit<Siswa, 'id' | 'createdAt' | 'createdBy'>>): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const getRequest = store.get(id)
    
    getRequest.onsuccess = () => {
      const siswa = getRequest.result
      if (!siswa) {
        reject(new Error('Siswa tidak ditemukan'))
        return
      }

      const siswaUpdate = { ...siswa, ...updates }
      const updateRequest = store.put(siswaUpdate)
      
      updateRequest.onsuccess = () => resolve()
      updateRequest.onerror = () => reject(updateRequest.error)
    }
    
    getRequest.onerror = () => reject(getRequest.error)
  })
}

// DELETE: Delete siswa
export async function hapusSiswa(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
