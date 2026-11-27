import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { openDatabase } from '@/core/docs/database'
import { addField, addRow, createDatabase, setCell, updateDbView } from '@/core/model/database'
import { openDbSession, type DbState } from './session'

const until = async (store: { get(): DbState | null }, test: (s: DbState) => boolean) => {
  for (let i = 0; i < 100; i++) {
    const s = store.get()
    if (s && test(s)) return s
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error('timeout')
}

describe('database session (M4-04)', () => {
  it('follows row and setting changes incrementally', async () => {
    const { docs, release } = await openDatabase('sess')
    const { viewId } = createDatabase(new Y.Doc(), docs, { dbId: 'sess', primaryName: 'Name', rows: 2 })
    const session = openDbSession('sess', viewId)
    let s = await until(session.store, (x) => x.result.rowIds.length === 2)
    const primary = s.meta.primaryFieldId

    const id = addRow(docs, { cells: { [primary]: 'hello' } })
    s = await until(session.store, (x) => x.result.rowIds.length === 3)
    expect(s.result.rowIds.at(-1)).toBe(id)

    updateDbView(docs, viewId, {
      filter: { op: 'and', items: [{ id: 'f', fieldId: primary, cond: 'contains', value: 'hel' }] },
    })
    s = await until(session.store, (x) => x.result.rowIds.length === 1)
    expect(s.view?.filter).not.toBeNull()

    const n = addField(docs, { name: 'N', type: 'number' })
    await until(session.store, (x) => x.fields.length === 2)
    setCell(docs, id, n, 3)
    await until(session.store, () => session.row(id)?.cells[n] === 3)

    session.setSearch('zzz')
    await until(session.store, (x) => x.result.rowIds.length === 0 && x.search === 'zzz')
    session.close()
    release()
  })
})
