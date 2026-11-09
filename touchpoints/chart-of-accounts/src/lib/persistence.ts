import type { StateStorage } from 'zustand/middleware'

/* Where the saved chart lives between visits.

   IndexedDB rather than localStorage because the seeded store serializes to
   ~4.2MB, almost all of it the 11,499 demo transactions, and localStorage caps
   at ~5MB. That leaves no room for the entries a reader posts, and a write past
   the cap throws rather than degrading. IndexedDB is bounded by disk instead. */
const DB_NAME = 'omne-coa'
const STORE_NAME = 'state'
export const STATE_KEY = 'coa-store'

/* No indexedDB means tests (vitest runs environment: 'node') or a browser with
   storage blocked. Both fall back to a store that holds nothing, so the app runs
   exactly as it did before this file existed instead of failing to start. */
export const persistenceAvailable = typeof indexedDB !== 'undefined'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const req = op(tx.objectStore(STORE_NAME))
    tx.oncomplete = () => resolve(req.result as T)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  }))
}

/* Persist writes on every set(), and a 4.2MB serialize per mutation would show
   as jank - pushing a toast alone fires two, one to add it and one to expire it.
   Bursts coalesce into a single trailing write, flushed on the way out so a
   change made just before the tab closes still lands. */
const WRITE_DELAY_MS = 400
let pending: string | null = null
let timer: ReturnType<typeof setTimeout> | null = null

function flush(): void {
  if (timer) { clearTimeout(timer); timer = null }
  if (pending === null) return
  const value = pending
  pending = null
  void run('readwrite', s => s.put(value, STATE_KEY)).catch(() => undefined)
}

/* Both events, because they cover different exits: `visibilitychange` fires on a
   tab switch, which is the earliest reliable warning and usually leaves the page
   alive long enough to finish writing; `pagehide` catches a close or a reload
   that never hid first. */
if (persistenceAvailable && typeof addEventListener === 'function') {
  addEventListener('pagehide', flush)
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

const indexedDbStorage: StateStorage = {
  getItem: name =>
    run<string | undefined>('readonly', s => s.get(name))
      .then(v => v ?? null)
      .catch(() => null),
  setItem: (_name, value) => {
    pending = value
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, WRITE_DELAY_MS)
  },
  removeItem: name => {
    pending = null
    if (timer) { clearTimeout(timer); timer = null }
    return run('readwrite', s => s.delete(name)).then(() => undefined).catch(() => undefined)
  },
}

const inertStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

export const savedStateStorage: StateStorage = persistenceAvailable ? indexedDbStorage : inertStorage

/* Drop the saved chart. The caller reloads afterwards rather than resetting
   state in place: seed.ts clamps its transaction dates to the day it runs, so
   only a fresh module evaluation puts the demo history back against today. */
export async function clearSavedState(): Promise<void> {
  await savedStateStorage.removeItem(STATE_KEY)
}
