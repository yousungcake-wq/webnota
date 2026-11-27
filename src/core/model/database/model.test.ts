import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { listViews } from '../views'
import {
  addField,
  addRow,
  addRows,
  createDatabase,
  deleteField,
  deleteRows,
  duplicateField,
  duplicateRow,
  getRow,
  listFields,
  listRows,
  moveRow,
  moveViewField,
  orderedFields,
  PrimaryFieldError,
  readDbMeta,
  readViewSettings,
  renameField,
  restoreRows,
  rowsOf,
  setCell,
  setFieldOptions,
  setFieldType,
  shardDocNames,
  updateDbView,
  type DbDocs,
} from './index'
import { hashId, shardOf, SHARD_COUNT } from './shard'

function setup(rows = 0) {
  const ws = new Y.Doc()
  ws.getMap('spaces').set('s', new Y.Map())
  const db: DbDocs = { schema: new Y.Doc(), shards: Array.from({ length: SHARD_COUNT }, () => new Y.Doc()) }
  const { viewId } = createDatabase(ws, db, { dbId: 'd1', primaryName: 'Name', title: 'Tasks', rows, spaceId: 's' })
  return { ws, db, viewId, primary: readDbMeta(db).primaryFieldId }
}

/** Two replicas of the same database, to check concurrent edits merge. */
function sync(a: DbDocs, b: DbDocs) {
  const pairs: [Y.Doc, Y.Doc][] = [[a.schema, b.schema], ...a.shards.map((s, i) => [s, b.shards[i]!] as [Y.Doc, Y.Doc])]
  for (const [x, y] of pairs) {
    Y.applyUpdate(y, Y.encodeStateAsUpdate(x))
    Y.applyUpdate(x, Y.encodeStateAsUpdate(y))
  }
}
function clone(db: DbDocs): DbDocs {
  const c = { schema: new Y.Doc(), shards: db.shards.map(() => new Y.Doc()) }
  sync(db, c)
  return c
}

describe('shards (spec/02 §1)', () => {
  it('hash is stable and spreads ids over 8 shards', () => {
    expect(hashId('abc')).toBe(440920331) // FNV-1a: never change (rows would move shards)
    const counts = new Array(SHARD_COUNT).fill(0)
    for (let i = 0; i < 800; i++) counts[shardOf(`row${i}`)]++
    expect(counts.every((n) => n > 50)).toBe(true)
  })
  it('names the docs', () => {
    expect(shardDocNames('d1')).toEqual([
      'dbr/d1/0',
      'dbr/d1/1',
      'dbr/d1/2',
      'dbr/d1/3',
      'dbr/d1/4',
      'dbr/d1/5',
      'dbr/d1/6',
      'dbr/d1/7',
    ])
  })
})

describe('createDatabase (DB-F05)', () => {
  it('creates a database view in the workspace and a primary text field', () => {
    const { ws, db, viewId, primary } = setup(3)
    const view = listViews(ws).find((v) => v.id === viewId)!
    expect(view).toMatchObject({ kind: 'database', layout: 'grid', title: 'Tasks', spaceId: 's' })
    expect(ws.getMap<Y.Map<unknown>>('views').get(viewId)!.get('databaseId')).toBe('d1')
    expect(readDbMeta(db)).toMatchObject({ shardCount: 8, primaryFieldId: primary })
    expect(listFields(db)).toEqual([expect.objectContaining({ id: primary, name: 'Name', type: 'text' })])
    expect(listRows(db)).toHaveLength(3)
    const settings = readViewSettings(db, viewId)!
    expect(settings).toMatchObject({ layout: 'grid', filter: null, sorts: [], frozenColumns: 1 })
    expect(settings.fields[primary]).toMatchObject({ visible: true, wrap: false })
  })
  it('stores each row in its shard', () => {
    const { db } = setup(20)
    for (const r of listRows(db)) expect(rowsOf(db.shards[shardOf(r.id)]!).has(r.id)).toBe(true)
  })
})

describe('fields', () => {
  it('adds fields at the end or next to another in the view, renames, sets options', () => {
    const { db, viewId, primary } = setup()
    const a = addField(db, { name: 'A', type: 'number' })
    const b = addField(db, { name: 'B', type: 'checkbox', viewId, afterId: primary })
    const c = addField(db, { name: 'C', type: 'url', viewId, beforeId: a })
    const view = readViewSettings(db, viewId)!
    expect(orderedFields(listFields(db), view).map((f) => f.id)).toEqual([primary, b, c, a])
    renameField(db, a, 'Amount')
    setFieldOptions(db, a, { format: 'currency', currency: 'KRW', decimals: 0 })
    setFieldOptions(db, a, { decimals: undefined })
    expect(listFields(db).find((f) => f.id === a)).toMatchObject({
      name: 'Amount',
      options: { format: 'currency', currency: 'KRW' },
    })
    moveViewField(db, viewId, a, 0)
    expect(orderedFields(listFields(db), readViewSettings(db, viewId)!)[0]!.id).toBe(a)
  })
  it('refuses to delete or retype the primary field', () => {
    const { db, primary } = setup()
    expect(() => deleteField(db, primary)).toThrow(PrimaryFieldError)
    expect(() => setFieldType(db, primary, 'number')).toThrow(PrimaryFieldError)
  })
  it('deleting a field removes its settings, sorts and cells', () => {
    const { db, viewId } = setup()
    const f = addField(db, { name: 'N', type: 'number' })
    const r = addRow(db, { cells: { [f]: 3 } })
    updateDbView(db, viewId, { sorts: [{ id: 's', fieldId: f, dir: 'asc' }] })
    deleteField(db, f)
    expect(listFields(db).map((x) => x.id)).not.toContain(f)
    expect(readViewSettings(db, viewId)!.fields[f]).toBeUndefined()
    expect(readViewSettings(db, viewId)!.sorts).toEqual([])
    expect(getRow(db, r)!.cells).toEqual({})
  })
  it('duplicates a field with its cells', () => {
    const { db, viewId } = setup()
    const f = addField(db, { name: 'N', type: 'number', options: { decimals: 2 } })
    const r = addRow(db, { cells: { [f]: 3 } })
    const copy = duplicateField(db, f, 'N copy', viewId)!
    expect(listFields(db).find((x) => x.id === copy)).toMatchObject({ type: 'number', options: { decimals: 2 } })
    expect(getRow(db, r)!.cells[copy]).toBe(3)
  })
  it('a field added on another device shows up at the end of views that do not know it', () => {
    const { db, viewId, primary } = setup()
    const f = addField(db, { name: 'X', type: 'text' })
    const view = readViewSettings(db, viewId)!
    delete view.fields[f]
    expect(orderedFields(listFields(db), view).map((x) => x.id)).toEqual([primary, f])
  })
})

describe('rows and cells', () => {
  it('adds rows at the end, after or before others; moves and duplicates', () => {
    const { db } = setup()
    const a = addRow(db)
    const c = addRow(db)
    const b = addRow(db, { afterId: a })
    const z = addRow(db, { beforeId: a })
    expect(listRows(db).map((r) => r.id)).toEqual([z, a, b, c])
    moveRow(db, z, { afterId: c })
    expect(listRows(db).map((r) => r.id)).toEqual([a, b, c, z])
    const d = duplicateRow(db, a)!
    expect(listRows(db).map((r) => r.id)).toEqual([a, d, b, c, z])
    const removed = [getRow(db, b)!, getRow(db, c)!]
    deleteRows(db, [b, c])
    expect(listRows(db).map((r) => r.id)).toEqual([a, d, z])
    restoreRows(db, removed)
    expect(listRows(db).map((r) => r.id)).toEqual([a, d, b, c, z])
  })
  it('appends many rows at once in order (bulk)', () => {
    const { db, primary } = setup(1)
    const first = listRows(db)[0]!.id
    const last = addRow(db)
    const ids = addRows(db, [{ [primary]: 'x' }, { [primary]: 'y' }, {}], { afterId: first })
    expect(listRows(db).map((r) => r.id)).toEqual([first, ...ids, last])
    expect(getRow(db, ids[1]!)!.cells[primary]).toBe('y')
  })
  it('sets and clears cells, stamping updatedAt', () => {
    const { db, primary } = setup()
    const r = addRow(db)
    const before = getRow(db, r)!.updatedAt
    setCell(db, r, primary, 'Hello')
    expect(getRow(db, r)!.cells[primary]).toBe('Hello')
    expect(getRow(db, r)!.updatedAt).toBeGreaterThanOrEqual(before)
    setCell(db, r, primary, null)
    expect(getRow(db, r)!.cells).toEqual({})
  })
  it('concurrent edits to different cells of a row merge; the same cell is last-writer-wins', () => {
    const { db, primary } = setup()
    const n = addField(db, { name: 'N', type: 'number' })
    const r = addRow(db)
    const other = clone(db)
    setCell(db, r, primary, 'mine')
    setCell(other, r, n, 5)
    sync(db, other)
    expect(getRow(db, r)!.cells).toEqual({ [primary]: 'mine', [n]: 5 })
    expect(getRow(other, r)!.cells).toEqual(getRow(db, r)!.cells)
    setCell(db, r, n, 1)
    setCell(other, r, n, 2)
    sync(db, other)
    expect(getRow(db, r)!.cells[n]).toBe(getRow(other, r)!.cells[n])
  })
  it('concurrent inserts at the same place still sort deterministically', () => {
    const { db } = setup()
    const a = addRow(db)
    const other = clone(db)
    const x = addRow(db, { afterId: a })
    const y = addRow(other, { afterId: a })
    sync(db, other)
    expect(listRows(db).map((r) => r.id)).toEqual(listRows(other).map((r) => r.id))
    expect(listRows(db).map((r) => r.id)).toEqual(expect.arrayContaining([a, x, y]))
    const z = addRow(db, { afterId: listRows(db)[1]!.id })
    expect(listRows(db).map((r) => r.id)[2]).toBe(z)
  })
})
