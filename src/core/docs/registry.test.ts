import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearDirty,
  evictIdleDocs,
  getDirty,
  getLoadedDoc,
  loadedDocCount,
  markDirty,
  openDoc,
  retainDoc,
  setDocLimit,
} from './registry'

const names = (n: number) => Array.from({ length: n }, (_, i) => `doc/d${i}`)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(1_000_000)
  setDocLimit(3)
})
afterEach(async () => {
  for (const [n, g] of Object.entries(getDirty())) clearDirty(n, g)
  vi.setSystemTime(10_000_000)
  setDocLimit(0)
  evictIdleDocs() // unload everything between tests
  setDocLimit(30)
  vi.useRealTimers()
})

const later = (ms = 60_000) => vi.setSystemTime(Date.now() + ms)

describe('doc registry LRU (SY-01)', () => {
  it('keeps at most the limit, unloading least recently used idle docs first', async () => {
    for (const n of names(5)) await openDoc(n)
    later()
    await openDoc('doc/d1') // touch: now most recent
    later(1) // d1 was just used: protected for a short grace period
    evictIdleDocs()
    expect(loadedDocCount()).toBe(3)
    expect(getLoadedDoc('doc/d0')).toBeUndefined()
    expect(getLoadedDoc('doc/d2')).toBeUndefined()
    expect(getLoadedDoc('doc/d1')).toBeDefined()
    expect(getLoadedDoc('doc/d4')).toBeDefined()
  })

  it('never unloads retained, dirty or recently used docs, nor the workspace', async () => {
    await openDoc('workspace')
    for (const n of names(4)) await openDoc(n)
    const release = retainDoc('doc/d0')
    markDirty('doc/d1')
    later()
    await openDoc('doc/d3') // recently used
    evictIdleDocs()
    for (const n of ['workspace', 'doc/d0', 'doc/d1', 'doc/d3']) expect(getLoadedDoc(n), n).toBeDefined()
    expect(getLoadedDoc('doc/d2')).toBeUndefined()

    release()
    later()
    evictIdleDocs()
    expect(getLoadedDoc('doc/d0')).toBeUndefined()
  })

  it('a reopened doc loads its content back from IndexedDB', async () => {
    const doc = await openDoc('doc/kept')
    doc.getText('t').insert(0, 'persisted')
    await new Promise((r) => setTimeout(r, 30)) // y-indexeddb writes asynchronously
    clearDirty('doc/kept', getDirty()['doc/kept']!)
    setDocLimit(0)
    later()
    evictIdleDocs()
    expect(getLoadedDoc('doc/kept')).toBeUndefined()
    setDocLimit(3)
    const again = await openDoc('doc/kept')
    expect(again).not.toBe(doc)
    expect(again.getText('t').toString()).toBe('persisted')
  })

  it('retain counts nest', async () => {
    await openDoc('doc/x')
    const r1 = retainDoc('doc/x')
    const r2 = retainDoc('doc/x')
    r1()
    r1() // double release is ignored
    setDocLimit(0)
    later()
    evictIdleDocs()
    expect(getLoadedDoc('doc/x')).toBeDefined()
    r2()
    evictIdleDocs()
    expect(getLoadedDoc('doc/x')).toBeUndefined()
  })
})
