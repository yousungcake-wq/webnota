/// <reference lib="webworker" />
import { createSearch, type SearchIndex } from './engine'

/**
 * Search worker (WS-07): owns the MiniSearch index, persists it to IndexedDB
 * (`<db>`/kv/'index') two seconds after the last change. Protocol in client.ts.
 */
type In =
  | { type: 'init'; db: string }
  | { type: 'upsert'; id: string; title: string; body: string; version: string }
  | { type: 'remove'; id: string }
  | { type: 'query'; q: string; reqId: number }
  | { type: 'flush' }

let index: SearchIndex = createSearch()
let meta: Record<string, { title: string; version: string }> = {}
let dbName = ''
let saveTimer: ReturnType<typeof setTimeout> | undefined

const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('kv')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

async function load(): Promise<string | undefined> {
  const db = await open()
  return new Promise((resolve) => {
    const req = db.transaction('kv').objectStore('kv').get('index')
    req.onsuccess = () => {
      db.close()
      resolve(req.result as string | undefined)
    }
    req.onerror = () => {
      db.close()
      resolve(undefined)
    }
  })
}

async function save() {
  const db = await open()
  const tx = db.transaction('kv', 'readwrite')
  tx.objectStore('kv').put(JSON.stringify({ search: index.toJSON(), meta }), 'index')
  tx.oncomplete = () => db.close()
}

const scheduleSave = () => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void save(), 2000)
}

self.onmessage = async (e: MessageEvent<In>) => {
  const m = e.data
  switch (m.type) {
    case 'init': {
      dbName = m.db
      try {
        const raw = await load()
        if (raw) {
          const data = JSON.parse(raw) as { search: string; meta: typeof meta }
          index = createSearch(data.search)
          meta = data.meta
        }
      } catch {
        index = createSearch()
        meta = {}
      }
      self.postMessage({ type: 'ready', meta })
      break
    }
    case 'upsert':
      index.upsert({ id: m.id, title: m.title, body: m.body })
      meta[m.id] = { title: m.title, version: m.version }
      scheduleSave()
      break
    case 'remove':
      index.remove(m.id)
      delete meta[m.id]
      scheduleSave()
      break
    case 'query':
      self.postMessage({ type: 'results', reqId: m.reqId, hits: index.query(m.q) })
      break
    case 'flush':
      clearTimeout(saveTimer)
      void save()
      break
  }
}
