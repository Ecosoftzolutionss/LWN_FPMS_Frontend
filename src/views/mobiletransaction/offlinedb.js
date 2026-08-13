// Lightweight IndexedDB wrapper for the Material Issue offline flow.
// No external dependency — plain native IndexedDB, wrapped in promises.
// Two object stores:
//   - "pallets"       : the last-synced snapshot of available pallets
//                        (Part -> Store Location / Pallet No / Qty),
//                        downloaded on Data Sync while on Wi-Fi.
//                        KEYED BY palletNo (NOT itemId) — a single item
//                        can have MANY pallets in store, and keying by
//                        itemId would silently overwrite/lose all but
//                        the last one.
//   - "pendingIssues" : Material Issue records created while offline,
//                        queued here until the next Data Sync uploads
//                        them to the real backend.

const DB_NAME = 'material_issue_offline'
const DB_VERSION = 2 // bumped: pallets keyPath changed from itemId -> palletNo

const openDB = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result

      // If upgrading from v1 (itemId-keyed), drop and recreate the
      // pallets store so old bad data / old key structure is cleared.
      if (event.oldVersion < 2 && db.objectStoreNames.contains('pallets')) {
        db.deleteObjectStore('pallets')
      }

      if (!db.objectStoreNames.contains('pallets')) {
        db.createObjectStore('pallets', { keyPath: 'palletNo' })
      }
      if (!db.objectStoreNames.contains('pendingIssues')) {
        db.createObjectStore('pendingIssues', { keyPath: 'localId', autoIncrement: true })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const withStore = async (storeName, mode, fn) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const result = fn(store)
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
  })
}

// ---- Pallets cache ----

export const replacePalletsCache = async (pallets) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pallets', 'readwrite')
    const store = tx.objectStore('pallets')
    store.clear()
    pallets.forEach((p) => store.put(p))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const getAllPallets = () =>
  new Promise(async (resolve, reject) => {
    const db = await openDB()
    const tx = db.transaction('pallets', 'readonly')
    const store = tx.objectStore('pallets')
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })

// ---- Pending (offline-queued) issues ----

export const queuePendingIssue = async (issue) =>
  withStore('pendingIssues', 'readwrite', (store) => store.add(issue))

export const getAllPendingIssues = () =>
  new Promise(async (resolve, reject) => {
    const db = await openDB()
    const tx = db.transaction('pendingIssues', 'readonly')
    const store = tx.objectStore('pendingIssues')
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })

export const removePendingIssue = async (localId) =>
  withStore('pendingIssues', 'readwrite', (store) => store.delete(localId))

export const countPendingIssues = async () => {
  const all = await getAllPendingIssues()
  return all.length
}

// ---- Clear (dev/reset utilities) ----

export const clearAllPendingIssues = async () => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingIssues', 'readwrite')
    tx.objectStore('pendingIssues').clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const clearPalletsCache = async () => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pallets', 'readwrite')
    tx.objectStore('pallets').clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}