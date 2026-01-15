// IndexedDB untuk data jurusan

export type Jurusan = {
  id: string
  nama: string // Nama jurusan (misal: RPL, TKJ, MM)
  deskripsi?: string // Deskripsi jurusan
  createdAt: string
}

const DB_NAME = 'JagatKawruhDB'
const STORE_NAME = 'jurusan'
const DB_VERSION = 10

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create jurusan store if not exists
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('nama', 'nama', { unique: false }) // Tidak unique, cek manual saja
      }

      // Add default jurusan
      if (event.oldVersion < DB_VERSION) {
        const tx = (event.target as IDBOpenDBRequest).transaction
        if (tx) {
          const store = tx.objectStore(STORE_NAME)
          const defaultJurusan = [
            { id: 'JUR-1', nama: 'RPL', deskripsi: 'Rekayasa Perangkat Lunak', createdAt: new Date().toISOString() },
            { id: 'JUR-2', nama: 'TKJ', deskripsi: 'Teknik Komputer dan Jaringan', createdAt: new Date().toISOString() },
            { id: 'JUR-3', nama: 'MM', deskripsi: 'Multimedia', createdAt: new Date().toISOString() },
            { id: 'JUR-4', nama: 'AKL', deskripsi: 'Akuntansi dan Keuangan Lembaga', createdAt: new Date().toISOString() },
          ]
          
          defaultJurusan.forEach(jur => {
            try {
              store.add(jur)
            } catch (e) {
              // Ignore if already exists
            }
          })
        }
      }
    }
  })
}

// CREATE: Tambah jurusan baru
export async function tambahJurusan(jurusan: Omit<Jurusan, 'id' | 'createdAt'>): Promise<void> {
  const db = await openDB()
  
  // Cek duplikasi manual (case-insensitive)
  const semuaData = await semuaJurusan()
  const namaBaru = jurusan.nama.trim().toUpperCase()
  const sudahAda = semuaData.some(j => j.nama.trim().toUpperCase() === namaBaru)
  
  if (sudahAda) {
    throw new Error('Nama jurusan sudah ada')
  }
  
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  const jurusanBaru: Jurusan = {
    ...jurusan,
    id: `JUR-${Date.now()}`,
    createdAt: new Date().toISOString()
  }

  return new Promise((resolve, reject) => {
    const request = store.add(jurusanBaru)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// READ: Get all jurusan
export async function semuaJurusan(): Promise<Jurusan[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => {
      console.log('📚 Data jurusan dari DB:', request.result.length)
      resolve(request.result)
    }
    request.onerror = () => reject(request.error)
  })
}

// READ: Get jurusan by ID
export async function jurusanById(id: string): Promise<Jurusan | null> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

// UPDATE: Update jurusan
export async function updateJurusan(id: string, updates: Partial<Omit<Jurusan, 'id' | 'createdAt'>>): Promise<void> {
  const db = await openDB()
  
  // Jika update nama, cek duplikasi (kecuali dengan diri sendiri)
  if (updates.nama) {
    const semuaData = await semuaJurusan()
    const namaBaru = updates.nama.trim().toUpperCase()
    const sudahAda = semuaData.some(j => j.id !== id && j.nama.trim().toUpperCase() === namaBaru)
    
    if (sudahAda) {
      throw new Error('Nama jurusan sudah ada')
    }
  }
  
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const getRequest = store.get(id)
    
    getRequest.onsuccess = () => {
      const jurusan = getRequest.result
      if (!jurusan) {
        reject(new Error('Jurusan tidak ditemukan'))
        return
      }

      const jurusanUpdate = { ...jurusan, ...updates }
      const updateRequest = store.put(jurusanUpdate)
      
      updateRequest.onsuccess = () => resolve()
      updateRequest.onerror = () => reject(updateRequest.error)
    }
    
    getRequest.onerror = () => reject(getRequest.error)
  })
}

// DELETE: Delete jurusan
export async function hapusJurusan(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// UTILITY: Seed default jurusan (untuk debugging)
export async function seedDefaultJurusan(): Promise<void> {
  const db = await openDB()
  
  // Check langsung dari store, jangan pakai semuaJurusan() untuk avoid circular call
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  
  return new Promise((resolve, reject) => {
    const countRequest = store.count()
    
    countRequest.onsuccess = () => {
      const count = countRequest.result
      
      if (count > 0) {
        console.log('⚠️ Data jurusan sudah ada:', count, 'records')
        resolve()
        return
      }
      
      // Jika kosong, insert default data
      const txWrite = db.transaction(STORE_NAME, 'readwrite')
      const storeWrite = txWrite.objectStore(STORE_NAME)
      
      const defaultJurusan = [
        { id: 'JUR-1', nama: 'RPL', deskripsi: 'Rekayasa Perangkat Lunak', createdAt: new Date().toISOString() },
        { id: 'JUR-2', nama: 'TKJ', deskripsi: 'Teknik Komputer dan Jaringan', createdAt: new Date().toISOString() },
        { id: 'JUR-3', nama: 'MM', deskripsi: 'Multimedia', createdAt: new Date().toISOString() },
        { id: 'JUR-4', nama: 'AKL', deskripsi: 'Akuntansi dan Keuangan Lembaga', createdAt: new Date().toISOString() },
      ]
      
      let completed = 0
      const total = defaultJurusan.length
      
      defaultJurusan.forEach(jur => {
        const req = storeWrite.add(jur)
        req.onsuccess = () => {
          completed++
          if (completed === total) {
            console.log('✅ Default jurusan berhasil di-seed:', total, 'records')
            resolve()
          }
        }
        req.onerror = () => {
          console.error('Error seeding jurusan:', req.error)
          reject(req.error)
        }
      })
    }
    
    countRequest.onerror = () => reject(countRequest.error)
  })
}
