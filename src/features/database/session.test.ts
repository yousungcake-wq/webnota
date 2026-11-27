import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { openDatabase } from '@/core/docs/database'
import { addField, addRow, createDatabase, setCell, updateDbView } from '@/core/model/database'
import { readFirstScreen, screenKey, screenRowIds, writeFirstScreen } from './firstScreen'
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

describe('first-screen cache (M5-00)', () => {
  it('keeps the first rows overall and per group', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `r${i}`)
    const got = screenRowIds({ rowIds: ids, calcs: {}, groups: [{ key: 'a', rowIds: ['r90', 'r1'] }] }, 3)
    expect(got).toEqual(['r0', 'r1', 'r2', 'r90'])
  })

  it('shows the cached screen read-only until the live state replaces it, and saves on close', async () => {
    const { docs, release } = await openDatabase('cache')
    const { viewId } = createDatabase(new Y.Doc(), docs, { dbId: 'cache', primaryName: 'Name', rows: 2 })
    const live = openDbSession('cache', viewId)
    const s0 = await until(live.store, (x) => x.result.rowIds.length === 2)
    live.close()
    const key = screenKey('cache', viewId)
    for (let i = 0; i < 50 && !(await readFirstScreen(key)); i++) await new Promise((r) => setTimeout(r, 10))
    // closing saved the live screen: its two rows
    const saved = await readFirstScreen(key)
    expect(saved?.result.rowIds).toEqual(s0.result.rowIds)
    expect(saved?.rows.map((r) => r.id)).toEqual(s0.result.rowIds)
    release()

    // a database whose docs are not loaded yet ('other' is empty): the cached screen comes first
    await writeFirstScreen({ ...saved!, key: screenKey('other', viewId) })
    const session = openDbSession('other', viewId)
    const states: DbState[] = []
    session.store.subscribe(() => states.push(session.store.get()!))
    await until(session.store, (x) => !x.preview)
    const preview = states.find((x) => x.preview)
    expect(preview?.result.rowIds).toEqual(s0.result.rowIds)
    expect(states.at(-1)?.result.rowIds).toEqual([])
    session.close()
  })
})
