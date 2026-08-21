// Lightweight IndexedDB wrapper for the Material Issue offline flow.
// No external dependency — plain native IndexedDB, wrapped in promises.
// Two object stores:
//   - "pallets"       : the last-synced snapshot of available pallets
//                        (Part -> Store Location / Pallet No / Qty),
//                        downloaded on Data Sync while on Wi-Fi.
//                        KEYED BY `id` (the pallet's real database
//                        primary key) — NOT by palletNo or
//                        fifoPalletNo. Those are human-readable
//                        labels generated from a sequence that gets
//                        reset, so they get RECYCLED across
//                        different GRNs (e.g. two totally different
//                        physical pallets can both be labeled
//                        "GI-01"). Keying by palletNo used to mean
//                        `store.put()` would silently overwrite one
//                        real pallet's cached data with another's
//                        every time a label got reused — which is
//                        exactly what caused scanning "GI-01" to show
//                        unrelated data from a different GRN in the
//                        grid. `id` is the only field guaranteed
//                        unique per physical pallet.
//   - "pendingIssues" : Material Issue records created while offline,
//                        queued here until the next Data Sync uploads
//                        them to the real backend.

const DB_NAME = 'material_issue_offline'
const DB_VERSION = 6 // bumped: pallets keyPath changed from palletNo -> id

// bumped: added pendingVerifications store

const openDB = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result

      if (event.oldVersion < 3 && db.objectStoreNames.contains('pallets')) {
        db.deleteObjectStore('pallets')
      }

      if (!db.objectStoreNames.contains('pallets')) {
        db.createObjectStore('pallets', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('pendingIssues')) {
        db.createObjectStore('pendingIssues', { keyPath: 'localId', autoIncrement: true })
      }
      // NEW — Store Verification records saved offline, uploaded on
      // the next Data Sync, same "queue now, sync later" pattern as
      // pendingIssues.
      if (!db.objectStoreNames.contains('pendingVerifications')) {
        db.createObjectStore('pendingVerifications', { keyPath: 'localId', autoIncrement: true })
      }

// inside onupgradeneeded, alongside the other stores:
if (!db.objectStoreNames.contains('verifiedPalletIds')) {
  db.createObjectStore('verifiedPalletIds', { keyPath: 'palletId' })
}

 if (!db.objectStoreNames.contains('localVerifiedPallets')) {
        db.createObjectStore('localVerifiedPallets', { keyPath: 'palletId' })
      }

      // bump DB_VERSION and add the store in onupgradeneeded, alongside the others:
if (!db.objectStoreNames.contains('palletStatusCache')) {
  db.createObjectStore('palletStatusCache', { keyPath: 'id' })
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
    pallets
      // Guard against a pre-fix backend response that hasn't been
      // redeployed yet — a record with no `id` can't be safely
      // stored under the id-keyed schema, so skip it rather than
      // throwing and losing the whole sync.
      .filter((p) => p.id !== undefined && p.id !== null)
      .forEach((p) => store.put(p))
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


// ---- Pending (offline-queued) verifications ----

export const queuePendingVerification = async (verification) =>
  withStore('pendingVerifications', 'readwrite', (store) => store.add(verification))

export const getAllPendingVerifications = () =>
  new Promise(async (resolve, reject) => {
    const db = await openDB()
    const tx = db.transaction('pendingVerifications', 'readonly')
    const store = tx.objectStore('pendingVerifications')
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })

export const removePendingVerification = async (localId) =>
  withStore('pendingVerifications', 'readwrite', (store) => store.delete(localId))

export const countPendingVerifications = async () => {
  const all = await getAllPendingVerifications()
  return all.length
}

export const clearAllPendingVerifications = async () => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pendingVerifications', 'readwrite')
    tx.objectStore('pendingVerifications').clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---- Server-confirmed verified pallet ids cache ----
// Refreshed on every Data Sync. Exists so the duplicate guard survives
// app restarts and doesn't reset just because a pending record synced
// and got removed from the local queue.

export const replaceVerifiedIdsCache = async (ids) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('verifiedPalletIds', 'readwrite')
    const store = tx.objectStore('verifiedPalletIds')
    store.clear()
    ids.filter((id) => id !== undefined && id !== null).forEach((palletId) => store.put({ palletId }))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const getAllVerifiedIds = () =>
  new Promise(async (resolve, reject) => {
    const db = await openDB()
    const tx = db.transaction('verifiedPalletIds', 'readonly')
    const store = tx.objectStore('verifiedPalletIds')
    const request = store.getAll()
    request.onsuccess = () => resolve((request.result || []).map((r) => r.palletId))
    request.onerror = () => reject(request.error)
  })


  // ---- Permanent local verified-pallet record (sync-independent) ----

export const markPalletVerifiedLocally = async (palletId, meta = {}) =>
  withStore('localVerifiedPallets', 'readwrite', (store) =>
    store.put({ palletId, ...meta, recordedAt: new Date().toISOString() })
  )

export const getAllLocallyVerifiedIds = () =>
  new Promise(async (resolve, reject) => {
    const db = await openDB()
    const tx = db.transaction('localVerifiedPallets', 'readonly')
    const store = tx.objectStore('localVerifiedPallets')
    const request = store.getAll()
    request.onsuccess = () => resolve((request.result || []).map((r) => r.palletId))
    request.onerror = () => reject(request.error)
  })

// Dev/reset utility only — clearing this deliberately re-allows
// re-verification on this device, so it should never be called as
// part of normal Data Sync or app flow.
export const clearLocalVerifiedPallets = async () => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('localVerifiedPallets', 'readwrite')
    tx.objectStore('localVerifiedPallets').clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const replacePalletStatusCache = async (pallets) => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('palletStatusCache', 'readwrite')
    const store = tx.objectStore('palletStatusCache')
    store.clear()
    pallets
      .filter((p) => p.id !== undefined && p.id !== null)
      .forEach((p) => store.put(p))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const getAllPalletStatus = () =>
  new Promise(async (resolve, reject) => {
    const db = await openDB()
    const tx = db.transaction('palletStatusCache', 'readonly')
    const store = tx.objectStore('palletStatusCache')
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })