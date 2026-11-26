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

describe('IndexedDB legacy names → wn:<wsId>: namespace (M0-16 page/→doc/, M0-18)', () => {
  it('copies workspace and page docs into the namespace, renaming page/ to doc/, and deletes the old DBs', async () => {
    await writeDb('webnota:page/p1', (d) => d.getText('t').insert(0, '첫 페이지'))
    await writeDb('webnota:doc/p2', (d) => d.getText('t').insert(0, 'second')) // copied by M0-16 already
    await writeDb('webnota:workspace', (d) => d.getText('t').insert(0, 'ws'))
    await writeDb('other-app', (d) => d.getText('t').insert(0, 'not ours'))
    const e = env()
    e.dirty = { 'page/p1': 3, workspace: 1 }

    expect((await copyLegacyDocs('W1', e)).sort()).toEqual(['doc/p1', 'doc/p2', 'workspace'])
    expect(await readDb('wn:W1:doc/p1')).toBe('첫 페이지')
    expect(await readDb('wn:W1:doc/p2')).toBe('second')
    expect(await readDb('wn:W1:workspace')).toBe('ws')
    expect(await dbNames()).toEqual(['other-app', 'wn:W1:doc/p1', 'wn:W1:doc/p2', 'wn:W1:workspace'])
    expect(e.dirty).toEqual({ 'doc/p1': 3, workspace: 1 })
    expect(e.marker).toBe(true)
  })

  it('merges page/ and doc/ copies of the same page and an existing target', async () => {
    await writeDb('webnota:page/p1', (d) => d.getText('t').insert(0, 'old'))
    await writeDb('webnota:doc/p1', (d) => d.getText('t').insert(0, 'mid '))
    await writeDb('wn:W1:doc/p1', (d) => d.getText('t').insert(0, 'new '))
    await copyLegacyDocs('W1', env())
    const text = await readDb('wn:W1:doc/p1')
    for (const part of ['old', 'mid', 'new']) expect(text).toContain(part)
  })

  it('runs once: the marker skips later boots', async () => {
    const e = env()
    e.marker = true
    await writeDb('webnota:page/p1', (d) => d.getText('t').insert(0, 'x'))
    expect(await copyLegacyDocs('W1', e)).toEqual([])
    expect(await dbNames()).toContain('webnota:page/p1')
  })

  it('without indexedDB.databases() it reads candidate ids from the old workspace', async () => {
    await writeDb('webnota:workspace', (d) => {
      d.getMap('views').set('p1', new Y.Map())
      d.getMap('pages').set('p2', new Y.Map())
    })
    await writeDb('webnota:page/p1', (d) => d.getText('t').insert(0, 'x'))
    await writeDb('webnota:doc/p2', (d) => d.getText('t').insert(0, 'y'))
    const e = { ...env(), listDatabases: undefined }
    expect((await copyLegacyDocs('W1', e)).sort()).toEqual(['doc/p1', 'doc/p2', 'workspace'])
    expect(await readDb('wn:W1:doc/p1')).toBe('x')
    expect(await readDb('wn:W1:doc/p2')).toBe('y')
    expect((await dbNames()).filter((n) => n?.startsWith('webnota:'))).toEqual([])
  })
})
