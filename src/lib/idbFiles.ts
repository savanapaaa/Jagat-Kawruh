type StoredFile = {
  id: string
  blob: Blob
  name: string
  type: string
  size: number
  createdAt: number
}

const DB_NAME = 'jagat_kawruh_files'
const DB_VERSION = 1
const STORE_NAME = 'files'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function putFile(input: {
  id: string
  blob: Blob
  name: string
}): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      const record: StoredFile = {
        id: input.id,
        blob: input.blob,
        name: input.name,
        type: input.blob.type,
        size: input.blob.size,
        createdAt: Date.now(),
      }

      store.put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function getFile(id: string): Promise<StoredFile | null> {
  const db = await openDb()
  try {
    return await new Promise<StoredFile | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(id)
      request.onsuccess = () => resolve((request.result as StoredFile | undefined) ?? null)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}
