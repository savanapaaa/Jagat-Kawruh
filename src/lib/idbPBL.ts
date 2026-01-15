// IndexedDB untuk Problem-Based Learning (PBL)

export type StatusPBL = 'Draft' | 'Aktif' | 'Selesai'

export type ProjectPBL = {
  id: string
  judul: string
  
  // Fase 1: Orientasi Masalah
  masalah: string // Deskripsi masalah/kasus yang harus dipecahkan
  
  // Fase 2: Organisasi Belajar
  tujuanPembelajaran: string // Apa yang harus dipelajari siswa
  panduan: string // Panduan untuk siswa
  
  // Fase 3: Penyelidikan
  referensi?: string // Link/referensi untuk riset
  
  // Metadata
  kelas: string // X, XI, XII
  jurusan: string // ID jurusan
  status: StatusPBL
  deadline: string // Format: YYYY-MM-DD
  createdAt: string
  createdBy: string // Email guru
}

// KELOMPOK PBL
export type KelompokPBL = {
  id: string
  projectId: string
  namaKelompok: string // Kelompok 1, Kelompok 2, dst
  anggota: AnggotaKelompok[] // Array siswa
  createdAt: string
}

export type AnggotaKelompok = {
  email: string
  nama: string
  kelas: string
  jurusan: string
}

// SUBMISI PBL (per kelompok)
export type SubmisiPBL = {
  id: string
  projectId: string
  projectJudul: string
  kelompokId: string // ID kelompok
  namaKelompok: string // Nama kelompok
  
  // Fase 1: Orientasi Masalah
  fase1_analisisMasalah?: string
  fase1_submittedAt?: string
  fase1_approved?: boolean
  
  // Fase 2: Organisasi Belajar
  fase2_rencanaBelajar?: string
  fase2_submittedAt?: string
  fase2_approved?: boolean
  
  // Fase 3: Penyelidikan
  fase3_hasilPenyelidikan?: string
  fase3_linkReferensi?: string
  fase3_submittedAt?: string
  fase3_approved?: boolean
  
  // Fase 4: Hasil Karya
  fase4_solusi?: string
  fase4_linkDemo?: string
  fase4_submittedAt?: string
  fase4_approved?: boolean
  
  // Fase 5: Evaluasi
  nilai?: number // 0-100
  feedback?: string // Feedback dari guru
  
  // Metadata
  createdAt: string
  lastUpdated: string
  dinilaiOleh?: string // Email guru yang menilai
}

const DB_NAME = 'JagatKawruhDB'
const PROJECT_STORE = 'pbl_projects'
const KELOMPOK_STORE = 'pbl_kelompok'
const SUBMISI_STORE = 'pbl_submisi'
const DB_VERSION = 10

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create project store
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        const store = db.createObjectStore(PROJECT_STORE, { keyPath: 'id' })
        store.createIndex('kelas', 'kelas', { unique: false })
        store.createIndex('jurusan', 'jurusan', { unique: false })
        store.createIndex('status', 'status', { unique: false })
      }

      // Create kelompok store
      if (!db.objectStoreNames.contains(KELOMPOK_STORE)) {
        const store = db.createObjectStore(KELOMPOK_STORE, { keyPath: 'id' })
        store.createIndex('projectId', 'projectId', { unique: false })
      }

      // Create submisi store
      if (!db.objectStoreNames.contains(SUBMISI_STORE)) {
        const store = db.createObjectStore(SUBMISI_STORE, { keyPath: 'id' })
        store.createIndex('projectId', 'projectId', { unique: false })
        store.createIndex('kelompokId', 'kelompokId', { unique: false })
        store.createIndex('projectId_kelompokId', ['projectId', 'kelompokId'], { unique: true })
      }
    }
  })
}

// ===== PROJECT PBL =====

// CREATE: Tambah project PBL
export async function tambahProjectPBL(project: Omit<ProjectPBL, 'id' | 'createdAt'>): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(PROJECT_STORE, 'readwrite')
  const store = tx.objectStore(PROJECT_STORE)

  const projectBaru: ProjectPBL = {
    ...project,
    id: `PBL-${Date.now()}`,
    createdAt: new Date().toISOString()
  }

  return new Promise((resolve, reject) => {
    const request = store.add(projectBaru)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// READ: Semua project PBL
export async function semuaProjectPBL(): Promise<ProjectPBL[]> {
  const db = await openDB()
  const tx = db.transaction(PROJECT_STORE, 'readonly')
  const store = tx.objectStore(PROJECT_STORE)

  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// READ: Project PBL by ID
export async function projectPBLById(id: string): Promise<ProjectPBL | null> {
  const db = await openDB()
  const tx = db.transaction(PROJECT_STORE, 'readonly')
  const store = tx.objectStore(PROJECT_STORE)

  return new Promise((resolve, reject) => {
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

// READ: Project PBL untuk siswa (berdasarkan kelas & jurusan)
export async function projectPBLUntukSiswa(kelas: string, jurusan: string): Promise<ProjectPBL[]> {
  const semuaProject = await semuaProjectPBL()
  return semuaProject.filter(
    (p) => p.status === 'Aktif' && p.kelas === kelas && p.jurusan === jurusan
  )
}

// UPDATE: Update project PBL
export async function updateProjectPBL(id: string, updates: Partial<Omit<ProjectPBL, 'id' | 'createdAt' | 'createdBy'>>): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(PROJECT_STORE, 'readwrite')
  const store = tx.objectStore(PROJECT_STORE)

  return new Promise((resolve, reject) => {
    const getRequest = store.get(id)
    
    getRequest.onsuccess = () => {
      const project = getRequest.result
      if (!project) {
        reject(new Error('Project PBL tidak ditemukan'))
        return
      }

      const projectUpdate = { ...project, ...updates }
      const updateRequest = store.put(projectUpdate)
      
      updateRequest.onsuccess = () => resolve()
      updateRequest.onerror = () => reject(updateRequest.error)
    }
    
    getRequest.onerror = () => reject(getRequest.error)
  })
}

// DELETE: Hapus project PBL
export async function hapusProjectPBL(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(PROJECT_STORE, 'readwrite')
  const store = tx.objectStore(PROJECT_STORE)

  return new Promise((resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ===== KELOMPOK PBL =====

// CREATE: Tambah kelompok
export async function tambahKelompokPBL(kelompok: Omit<KelompokPBL, 'id' | 'createdAt'>): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(KELOMPOK_STORE, 'readwrite')
  const store = tx.objectStore(KELOMPOK_STORE)

  const kelompokBaru: KelompokPBL = {
    ...kelompok,
    id: `KELOMPOK-${Date.now()}`,
    createdAt: new Date().toISOString()
  }

  return new Promise((resolve, reject) => {
    const request = store.add(kelompokBaru)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// READ: Ambil semua kelompok by projectId
export async function kelompokByProject(projectId: string): Promise<KelompokPBL[]> {
  const db = await openDB()
  const tx = db.transaction(KELOMPOK_STORE, 'readonly')
  const store = tx.objectStore(KELOMPOK_STORE)
  const index = store.index('projectId')

  return new Promise((resolve, reject) => {
    const request = index.getAll(projectId)
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// READ: Cari kelompok siswa (by email)
export async function cariKelompokSiswa(projectId: string, siswaEmail: string): Promise<KelompokPBL | null> {
  const kelompoks = await kelompokByProject(projectId)
  const found = kelompoks.find(k => k.anggota.some(a => a.email === siswaEmail))
  return found || null
}

// UPDATE: Update kelompok (tambah/hapus anggota)
export async function updateKelompokPBL(id: string, updates: Partial<Omit<KelompokPBL, 'id' | 'createdAt' | 'projectId'>>): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(KELOMPOK_STORE, 'readwrite')
  const store = tx.objectStore(KELOMPOK_STORE)

  return new Promise((resolve, reject) => {
    const getRequest = store.get(id)
    
    getRequest.onsuccess = () => {
      const kelompok = getRequest.result
      if (!kelompok) {
        reject(new Error('Kelompok tidak ditemukan'))
        return
      }

      const kelompokUpdate = { ...kelompok, ...updates }
      const updateRequest = store.put(kelompokUpdate)
      
      updateRequest.onsuccess = () => resolve()
      updateRequest.onerror = () => reject(updateRequest.error)
    }
    
    getRequest.onerror = () => reject(getRequest.error)
  })
}

// DELETE: Hapus kelompok
export async function hapusKelompokPBL(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(KELOMPOK_STORE, 'readwrite')
  const store = tx.objectStore(KELOMPOK_STORE)

  return new Promise((resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ===== SUBMISI PBL =====

// CREATE/UPDATE: Submit fase PBL
// CREATE/UPDATE: Submit fase PBL (per kelompok)
export function submitFasePBL(
  projectId: string,
  kelompokId: string,
  fase: 1 | 2 | 3 | 4,
  data: {
    fase1_analisisMasalah?: string
    fase2_rencanaBelajar?: string
    fase3_hasilPenyelidikan?: string
    fase3_linkReferensi?: string
    fase4_solusi?: string
    fase4_linkDemo?: string
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    openDB().then(db => {
      const timestamp = new Date().toISOString()
      
      // Cek existing submission by kelompok
      const checkTx = db.transaction(SUBMISI_STORE, 'readonly')
      const checkStore = checkTx.objectStore(SUBMISI_STORE)
      const checkIndex = checkStore.index('projectId_kelompokId')
      const getReq = checkIndex.get([projectId, kelompokId])
      
      getReq.onsuccess = () => {
        const existing = getReq.result as SubmisiPBL | undefined
        
        if (existing) {
          // Update existing submission
          const tx = db.transaction(SUBMISI_STORE, 'readwrite')
          const store = tx.objectStore(SUBMISI_STORE)
          
          const updated: SubmisiPBL = {
            ...existing,
            ...data,
            [`fase${fase}_submittedAt`]: timestamp,
            lastUpdated: timestamp
          }
          
          const updateReq = store.put(updated)
          updateReq.onsuccess = () => resolve()
          updateReq.onerror = () => reject(updateReq.error)
        } else {
          // Create new submission - get project and kelompok first
          const projectTx = db.transaction([PROJECT_STORE, KELOMPOK_STORE], 'readonly')
          const projectStore = projectTx.objectStore(PROJECT_STORE)
          const kelompokStore = projectTx.objectStore(KELOMPOK_STORE)
          
          const projectReq = projectStore.get(projectId)
          const kelompokReq = kelompokStore.get(kelompokId)
          
          let project: ProjectPBL | undefined
          let kelompok: KelompokPBL | undefined
          
          projectReq.onsuccess = () => {
            project = projectReq.result as ProjectPBL | undefined
            if (kelompok !== undefined) createSubmission()
          }
          
          kelompokReq.onsuccess = () => {
            kelompok = kelompokReq.result as KelompokPBL | undefined
            if (project !== undefined) createSubmission()
          }
          
          function createSubmission() {
            if (!project || !kelompok) {
              reject(new Error('Project atau Kelompok tidak ditemukan'))
              return
            }
            
            const tx = db.transaction(SUBMISI_STORE, 'readwrite')
            const store = tx.objectStore(SUBMISI_STORE)
            
            const submisiBaru: SubmisiPBL = {
              id: `SUB-${Date.now()}`,
              projectId,
              projectJudul: project.judul,
              kelompokId,
              namaKelompok: kelompok.namaKelompok,
              ...data,
              [`fase${fase}_submittedAt`]: timestamp,
              createdAt: timestamp,
              lastUpdated: timestamp
            }
            
            const addReq = store.add(submisiBaru)
            addReq.onsuccess = () => resolve()
            addReq.onerror = () => reject(addReq.error)
          }
          
          projectReq.onerror = () => reject(projectReq.error)
          kelompokReq.onerror = () => reject(kelompokReq.error)
        }
      }
      
      getReq.onerror = () => reject(getReq.error)
    }).catch(reject)
  })
}

// READ: Submisi by project & kelompok
export async function submisiByKelompok(projectId: string, kelompokId: string): Promise<SubmisiPBL | null> {
  const db = await openDB()
  const tx = db.transaction(SUBMISI_STORE, 'readonly')
  const store = tx.objectStore(SUBMISI_STORE)
  const index = store.index('projectId_kelompokId')

  return new Promise((resolve, reject) => {
    const request = index.get([projectId, kelompokId])
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

// READ: Semua submisi untuk project tertentu
export async function submisiByProject(projectId: string): Promise<SubmisiPBL[]> {
  const db = await openDB()
  const tx = db.transaction(SUBMISI_STORE, 'readonly')
  const store = tx.objectStore(SUBMISI_STORE)
  const index = store.index('projectId')

  return new Promise((resolve, reject) => {
    const request = index.getAll(projectId)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// UPDATE: Update submisi (edit solusi atau guru kasih nilai)
export async function updateSubmisiPBL(id: string, updates: Partial<Omit<SubmisiPBL, 'id' | 'submittedAt' | 'projectId' | 'siswaEmail'>>): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(SUBMISI_STORE, 'readwrite')
  const store = tx.objectStore(SUBMISI_STORE)

  return new Promise((resolve, reject) => {
    const getRequest = store.get(id)
    
    getRequest.onsuccess = () => {
      const submisi = getRequest.result
      if (!submisi) {
        reject(new Error('Submisi tidak ditemukan'))
        return
      }

      const submisiUpdate: SubmisiPBL = { 
        ...submisi, 
        ...updates,
        lastUpdated: new Date().toISOString()
      }
      const updateRequest = store.put(submisiUpdate)
      
      updateRequest.onsuccess = () => resolve()
      updateRequest.onerror = () => reject(updateRequest.error)
    }
    
    getRequest.onerror = () => reject(getRequest.error)
  })
}

// UPDATE: Approve fase (untuk guru)
export async function approveFasePBL(
  submisiId: string,
  fase: 1 | 2 | 3 | 4,
  approved: boolean
): Promise<void> {
  const updates: Partial<SubmisiPBL> = {
    [`fase${fase}_approved`]: approved
  } as any
  
  return updateSubmisiPBL(submisiId, updates)
}

// DELETE: Hapus submisi
export async function hapusSubmisiPBL(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(SUBMISI_STORE, 'readwrite')
  const store = tx.objectStore(SUBMISI_STORE)

  return new Promise((resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
