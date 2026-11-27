import { idbName } from '../docs/slots'

/**
 * The workspace's binary file store (SY-04): one IndexedDB database `wn:<wsId>:$files`
 * (removed with the workspace like its docs) with
 * - `pending`: files waiting for upload, keyed by file id (`<sha256>.<ext>`)
 * - `cache`: downloaded or uploaded file bytes for display (M3-02)
 * - `meta`: size and last use of each cached file, so the LRU trim (200MB) reads no bytes
 * Plain IndexedDB; no wrapper library (spec/10).
 */
export const FILES_DB = '$files'
export type StoreName = 'pending' | 'cache'

export interface CacheMeta {
  id: string
  size: number
  at: number
}

export interface StoredFile {
  id: string
  bytes: Uint8Array
  mime: string
  name: string
  size: number
  /** pending: added at; cache: last used (LRU) */
  at: number
}

const dbs = new Map<string, Promise<IDBDatabase>>()

function open(): Promise<IDBDatabase> {
  const name = idbName(FILES_DB)
  let p = dbs.get(name)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 2)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('pending')) db.createObjectStore('pending', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' })
      }
      req.onsuccess = () => {
        const db = req.result
        // another tab removing the workspace deletes this database
        db.onversionchange = () => {
          db.close()
          dbs.delete(name)
        }
        resolve(db)
      }
      req.onerror = () => {
        dbs.delete(name)
        reject(req.error ?? new Error('indexedDB open failed'))
      }
    })
    dbs.set(name, p)
  }
  return p
}

const done = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'))
  })

export async function getFile(store: StoreName, id: string): Promise<StoredFile | undefined> {
  const db = await open()
  return done(db.transaction(store).objectStore(store).get(id) as IDBRequest<StoredFile | undefined>)
}

export async function putFile(store: StoreName, file: StoredFile): Promise<void> {
  const db = await open()
  if (store === 'pending') {
    await done(db.transaction(store, 'readwrite').objectStore(store).put(file))
    return
  }
  const tx = db.transaction(['cache', 'meta'], 'readwrite')
  tx.objectStore('cache').put(file)
  tx.objectStore('meta').put({ id: file.id, size: file.bytes.length, at: file.at } satisfies CacheMeta)
  await complete(tx)
}

/** Marks a cached file as just used (LRU). */
export async function touchCached(id: string, size: number): Promise<void> {
  const db = await open()
  await done(db.transaction('meta', 'readwrite').objectStore('meta').put({ id, size, at: Date.now() }))
}

export async function cacheMeta(): Promise<CacheMeta[]> {
  const db = await open()
  return done(db.transaction('meta').objectStore('meta').getAll() as IDBRequest<CacheMeta[]>)
}

const complete = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('indexedDB transaction aborted'))
  })

export async function allFiles(store: StoreName): Promise<StoredFile[]> {
  const db = await open()
  return done(db.transaction(store).objectStore(store).getAll() as IDBRequest<StoredFile[]>)
}

export async function deleteFiles(store: StoreName, ids: string[]): Promise<void> {
  if (!ids.length) return
  const db = await open()
  const names = store === 'cache' ? ['cache', 'meta'] : [store]
  const tx = db.transaction(names, 'readwrite')
  for (const id of ids) for (const n of names) tx.objectStore(n).delete(id)
  await complete(tx)
}

/** Tests only: forget open connections (fake-indexeddb is reset between tests). */
export function resetFilesDb() {
  dbs.clear()
}
