/**
 * Minimal IndexedDB record store for larger tool state (spectra, DIF blocks,
 * images and measurement records). All failures degrade to "no saved state";
 * the UI must remain usable when storage is unavailable.
 */

const DB_NAME = 'crystaltoolbox'
const DB_VERSION = 1
const STORE_NAME = 'tool-records'

let dbPromise: Promise<IDBDatabase> | null = null

export function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

function openDatabase(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) return Promise.reject(new Error('IndexedDB unavailable'))
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    request.onblocked = () => reject(new Error('IndexedDB blocked'))
  }).catch((error) => {
    dbPromise = null
    throw error
  })

  return dbPromise
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const result = await requestAsPromise(tx.objectStore(STORE_NAME).get(key))
    return (result as T | undefined) ?? null
  } catch {
    return null
  }
}

export async function idbSet<T>(key: string, value: T): Promise<boolean> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, key)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write aborted'))
    })
    return true
  } catch {
    return false
  }
}

export async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB delete aborted'))
    })
  } catch {
    // ignore: clearing a missing record is a no-op
  }
}
