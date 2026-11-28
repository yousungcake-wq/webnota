import { getToken } from '../auth/auth'
import { syncStore, type Account } from '../sync/controller'
import { cacheMeta, deleteFiles, getFile, putFile, touchCached } from './db'

/**
 * Showing workspace files (SY-04, M3-02). The repository is private, so there is no
 * public URL: bytes come from the IndexedDB `cache` (or the upload queue), else from
 * GitHub, and are shown through an object URL. The cache keeps at most 200MB, least
 * recently used first out.
 */
export const CACHE_LIMIT_BYTES = 200 * 1024 * 1024

export type FileStatus = 'ready' | 'not-connected' | 'offline' | 'missing' | 'error'
export interface FileView {
  status: FileStatus
  url: string | null
}

type Download = (account: Account, token: string, id: string) => Promise<Uint8Array | null>
const remoteDownload: Download = async (a, token, id) => (await import('../sync/remote')).downloadRepoFile(a, token, id)
let download = remoteDownload

/** Tests only. */
export function setDownloader(fn: Download | null) {
  download = fn ?? remoteDownload
  urls.forEach((u) => URL.revokeObjectURL(u))
  urls.clear()
}

const isOffline = () => globalThis.navigator?.onLine === false
const urls = new Map<string, string>()
const inflight = new Map<string, Promise<FileView>>()

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  txt: 'text/plain',
}
export const mimeFor = (id: string) => MIME[id.slice(id.lastIndexOf('.') + 1)] ?? 'application/octet-stream'

function urlFor(id: string, bytes: Uint8Array, mime: string) {
  let url = urls.get(id)
  if (!url) {
    url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }))
    urls.set(id, url)
  }
  return url
}

/** Object URL for a file id, loading it from the cache, the upload queue or GitHub. */
export function loadFile(id: string): Promise<FileView> {
  const url = urls.get(id)
  if (url) return Promise.resolve({ status: 'ready', url })
  let p = inflight.get(id)
  if (!p) {
    p = resolve(id).finally(() => inflight.delete(id))
    inflight.set(id, p)
  }
  return p
}

async function resolve(id: string): Promise<FileView> {
  try {
    const cached = await getFile('cache', id)
    if (cached) {
      void touchCached(id, cached.bytes.length).catch(() => {})
      return { status: 'ready', url: urlFor(id, cached.bytes, cached.mime || mimeFor(id)) }
    }
    const pending = await getFile('pending', id)
    if (pending) {
      await putFile('cache', { ...pending, at: Date.now() })
      return { status: 'ready', url: urlFor(id, pending.bytes, pending.mime || mimeFor(id)) }
    }
  } catch {
    /* IndexedDB unavailable: try the network */
  }
  const account = syncStore.get().account
  const token = getToken()
  if (!account || !token) return { status: 'not-connected', url: null }
  if (isOffline()) return { status: 'offline', url: null }
  try {
    const bytes = await download(account, token, id)
    // not in the repository (yet): another device may still have it in its upload queue
    if (!bytes) return { status: 'missing', url: null }
    const mime = mimeFor(id)
    try {
      await putFile('cache', { id, bytes, mime, name: id, size: bytes.length, at: Date.now() })
      void trimCache().catch(() => {})
    } catch {
      /* shown anyway; cached next time */
    }
    return { status: 'ready', url: urlFor(id, bytes, mime) }
  } catch {
    return { status: isOffline() ? 'offline' : 'error', url: null }
  }
}

/** Drops least recently used files until the cache is under `limit` bytes. */
export async function trimCache(limit = CACHE_LIMIT_BYTES): Promise<string[]> {
  const meta = await cacheMeta()
  let total = meta.reduce((n, m) => n + m.size, 0)
  if (total <= limit) return []
  const drop: string[] = []
  for (const m of meta.sort((a, b) => a.at - b.at)) {
    if (total <= limit) break
    drop.push(m.id)
    total -= m.size
  }
  await deleteFiles('cache', drop)
  for (const id of drop) {
    const u = urls.get(id)
    if (u) URL.revokeObjectURL(u)
    urls.delete(id)
  }
  return drop
}

/** Saves a workspace file to the device (download link click). Loads it first if needed. */
export async function saveFile(id: string, name: string): Promise<FileStatus> {
  const v = await loadFile(id)
  if (!v.url) return v.status
  const a = document.createElement('a')
  a.href = v.url
  a.download = name || id
  document.body.append(a)
  a.click()
  a.remove()
  return 'ready'
}

/**
 * "Clear cache" (ST-08, M8-10): downloaded copies of files (they come back from the
 * repository when shown) and the service worker's runtime caches (KaTeX fonts). Files not
 * uploaded yet (`pending`) and the app itself (precache) are kept. Returns bytes freed.
 */
export async function clearFileCache(): Promise<number> {
  const { allFiles, deleteFiles } = await import('./db')
  const cached = await allFiles('cache')
  await deleteFiles(
    'cache',
    cached.map((f) => f.id),
  )
  if (typeof caches !== 'undefined')
    for (const name of await caches.keys()) if (!name.includes('precache')) await caches.delete(name)
  return cached.reduce((n, f) => n + f.size, 0)
}
