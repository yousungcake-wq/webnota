import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setToken } from '../auth/auth'
import { syncStore } from '../sync/controller'
import { idbName } from '../docs/slots'
import { cacheMeta, getFile, putFile, resetFilesDb } from './db'
import { loadFile, setDownloader, trimCache } from './cache'
import { addFile } from './upload'

const account = { login: 'me', avatarUrl: '', owner: 'me', repo: 'data', branch: 'main' }
const ID = `${'a'.repeat(64)}.png`

const mem = new Map<string, string>()
const storage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
}
vi.stubGlobal('localStorage', storage)

beforeEach(() => {
  resetFilesDb()
  indexedDB.deleteDatabase(idbName('$files'))
  setDownloader(null)
  syncStore.set((s) => ({ ...s, account: null }))
})
afterEach(() => setToken(null))

function connect() {
  setToken('t')
  syncStore.set((s) => ({ ...s, account }))
}

describe('file display cache (SY-04, M3-02)', () => {
  it('a just-added file shows at once from the cache, without network', async () => {
    const dl = vi.fn()
    setDownloader(dl)
    const ref = await addFile(new Blob([new Uint8Array([1, 2])], { type: 'image/png' }), 'a.png')
    const v = await loadFile(ref.id)
    expect(v.status).toBe('ready')
    expect(v.url).toMatch(/^blob:/)
    expect(dl).not.toHaveBeenCalled()
  })
  it('not connected / offline: placeholder states instead of a request', async () => {
    expect((await loadFile(ID)).status).toBe('not-connected')
    connect()
    vi.stubGlobal('navigator', { onLine: false })
    expect((await loadFile(ID)).status).toBe('offline')
    vi.unstubAllGlobals()
    vi.stubGlobal('localStorage', storage)
  })
  it('downloads once from GitHub, caches it, and reuses it (concurrent calls share a request)', async () => {
    connect()
    const dl = vi.fn(async () => new Uint8Array([9, 9, 9]))
    setDownloader(dl)
    const [a, b] = await Promise.all([loadFile(ID), loadFile(ID)])
    expect(a.status).toBe('ready')
    expect(b.url).toBe(a.url)
    expect(dl).toHaveBeenCalledTimes(1)
    expect((await getFile('cache', ID))?.bytes).toEqual(new Uint8Array([9, 9, 9]))
    setDownloader(dl) // forget object URLs: the next load reads IndexedDB, not the network
    expect((await loadFile(ID)).status).toBe('ready')
    expect(dl).toHaveBeenCalledTimes(1)
  })
  it('a file the repository does not have yet is "missing"; errors are "error"', async () => {
    connect()
    setDownloader(async () => null)
    expect((await loadFile(ID)).status).toBe('missing')
    setDownloader(async () => {
      throw new Error('500')
    })
    expect((await loadFile(ID)).status).toBe('error')
  })
  it('LRU trim drops the least recently used files over the limit', async () => {
    const put = (c: string, at: number) =>
      putFile('cache', {
        id: `${c.repeat(64)}.png`,
        bytes: new Uint8Array(10),
        mime: 'image/png',
        name: c,
        size: 10,
        at,
      })
    await put('1', 3)
    await put('2', 1)
    await put('3', 2)
    expect(await trimCache(25)).toEqual([`${'2'.repeat(64)}.png`])
    expect((await cacheMeta()).map((m) => m.id[0]).sort()).toEqual(['1', '3'])
    expect(await getFile('cache', `${'2'.repeat(64)}.png`)).toBeUndefined()
    expect(await trimCache(25)).toEqual([])
  })
})
