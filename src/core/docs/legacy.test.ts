import 'fake-indexeddb/auto'
import { IndexeddbPersistence } from 'y-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { copyLegacyDocs, type LegacyCopyEnv } from './legacy'

async function writeDb(name: string, fill: (doc: Y.Doc) => void) {
  const doc = new Y.Doc()
  const p = new IndexeddbPersistence(name, doc)
  await p.whenSynced
  fill(doc)
  await new Promise((r) => setTimeout(r, 20)) // y-indexeddb writes asynchronously
  await p.destroy()
}

async function readDb(name: string) {
  const doc = new Y.Doc()
  const p = new IndexeddbPersistence(name, doc)
  await p.whenSynced
  const text = doc.getText('t').toString()
  await p.destroy()
  return text
}

const dbNames = async () => (await indexedDB.databases()).map((d) => d.name).sort()

function env(): LegacyCopyEnv & { dirty: Record<string, number>; marker: boolean } {
  const e = {
    dirty: {} as Record<string, number>,
    marker: false,
    listDatabases: async () => (await indexedDB.databases()).map((d) => d.name ?? ''),
    isDone: () => e.marker,
    markDone: () => {
      e.marker = true
    },
    renameDirty(from: string, to: string) {
      if (from in e.dirty) {
        e.dirty[to] = e.dirty[from]!
        delete e.dirty[from]
      }
    },
  }
  return e
}

beforeEach(async () => {
  for (const d of await indexedDB.databases()) indexedDB.deleteDatabase(d.name!)
  await new Promise((r) => setTimeout(r, 10))
})

describe('IndexedDB page/ → doc/ copy (migration v2)', () => {
  it('copies every legacy page DB, deletes the old one and renames dirty flags', async () => {
    await writeDb('webnota:page/p1', (d) => d.getText('t').insert(0, '첫 페이지'))
    await writeDb('webnota:page/p2', (d) => d.getText('t').insert(0, 'second'))
    await writeDb('webnota:workspace', (d) => d.getMap('m').set('k', 1))
    const e = env()
    e.dirty = { 'page/p1': 3, workspace: 1 }

    expect((await copyLegacyDocs(e)).sort()).toEqual(['p1', 'p2'])
    expect(await readDb('webnota:doc/p1')).toBe('첫 페이지')
    expect(await readDb('webnota:doc/p2')).toBe('second')
    expect(await dbNames()).toEqual(['webnota:doc/p1', 'webnota:doc/p2', 'webnota:workspace'])
    expect(e.dirty).toEqual({ 'doc/p1': 3, workspace: 1 })
    expect(e.marker).toBe(true)
  })

  it('merges into an existing doc/ DB instead of overwriting it', async () => {
    await writeDb('webnota:page/p1', (d) => d.getText('t').insert(0, 'old'))
    await writeDb('webnota:doc/p1', (d) => d.getText('t').insert(0, 'new '))
    await copyLegacyDocs(env())
    const text = await readDb('webnota:doc/p1')
    expect(text).toContain('old')
    expect(text).toContain('new')
  })

  it('runs once: the marker skips later boots', async () => {
    const e = env()
    e.marker = true
    await writeDb('webnota:page/p1', (d) => d.getText('t').insert(0, 'x'))
    expect(await copyLegacyDocs(e)).toEqual([])
    expect(await dbNames()).toContain('webnota:page/p1')
  })

  it('without indexedDB.databases() it falls back to the given view ids', async () => {
    await writeDb('webnota:page/p1', (d) => d.getText('t').insert(0, 'x'))
    const e = { ...env(), listDatabases: undefined, fallbackIds: () => ['p1', 'never-existed'] }
    expect(await copyLegacyDocs(e)).toEqual(['p1'])
    expect(await readDb('webnota:doc/p1')).toBe('x')
    expect(await dbNames()).toEqual(['webnota:doc/p1'])
  })
})
