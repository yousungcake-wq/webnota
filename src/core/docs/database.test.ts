import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { addRow, createDatabase, rowCount, updateRow } from '../model/database'
import { createView, deleteViewPermanently } from '../model/views'
import { destroyUnreferencedDatabases, openDatabase, rowDocName } from './database'
import { clearDirty, evictIdleDocs, getDirty, getLoadedDoc, openDoc, setDocLimit } from './registry'

afterEach(() => {
  for (const [n, g] of Object.entries(getDirty())) clearDirty(n, g)
  vi.useRealTimers()
})

describe('database docs (M4-02)', () => {
  it('keeps the schema and all 8 shards loaded while open, evictable after release', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1_000_000)
    const { docs, release } = await openDatabase('keep')
    expect(docs.shards).toHaveLength(8)
    setDocLimit(0)
    vi.setSystemTime(2_000_000)
    evictIdleDocs()
    expect(getLoadedDoc('db/keep')).toBe(docs.schema)
    expect(getLoadedDoc('dbr/keep/7')).toBe(docs.shards[7])
    release()
    evictIdleDocs()
    expect(getLoadedDoc('db/keep')).toBeUndefined()
    setDocLimit(30)
  })

  it('a database edit marks its schema and the touched shard dirty', async () => {
    const ws = new Y.Doc()
    const { docs, release } = await openDatabase('dirt')
    createDatabase(ws, docs, { dbId: 'dirt', primaryName: 'Name' })
    const before = Object.keys(getDirty())
    expect(before).toContain('db/dirt')
    const id = addRow(docs)
    expect(Object.keys(getDirty()).some((n) => n.startsWith('dbr/dirt/'))).toBe(true)
    expect(rowCount(docs)).toBe(1)
    expect(id).toBeTruthy()
    release()
  })

  it('destroys the local data of databases no view points at any more', async () => {
    const ws = new Y.Doc()
    const { docs, release } = await openDatabase('gone')
    const { viewId } = createDatabase(ws, docs, { dbId: 'gone', primaryName: 'Name', rows: 2 })
    const keep = createView(ws, { kind: 'database', layout: 'grid', databaseId: 'kept' })
    const row = addRow(docs)
    updateRow(docs, row, { hasDoc: true })
    ;(await openDoc(rowDocName('gone', row))).getText('t').insert(0, 'body')
    release()
    await new Promise((r) => setTimeout(r, 30))

    deleteViewPermanently(ws, viewId)
    await destroyUnreferencedDatabases(ws, ['gone', 'kept'])
    expect(getLoadedDoc('db/gone')).toBeUndefined()
    expect(getLoadedDoc(rowDocName('gone', row))).toBeUndefined()
    const again = await openDatabase('gone')
    expect(rowCount(again.docs)).toBe(0)
    expect((await openDoc(rowDocName('gone', row))).getText('t').toString()).toBe('')
    again.release()
    expect(keep).toBeTruthy()
  })
})
