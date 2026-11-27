import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  addField,
  addRow,
  createDatabase,
  deleteRows,
  getRow,
  listFields,
  listRows,
  moveRow,
  observeRows,
  observeSchema,
  renameField,
  setCell,
  SHARD_COUNT,
  type DbDocs,
} from './index'
import { createLiveQuery } from './live'
import { runQuery } from './query'
import type { CellValue, FieldMeta, FilterGroup, GroupSettings, RowSnapshot, Sort } from './types'

const choices = [
  { id: 'o1', name: 'A', color: 'gray' },
  { id: 'o2', name: 'B', color: 'blue' },
]
const FIELDS: FieldMeta[] = [
  { id: 'text', name: 't', type: 'text', options: {}, createdAt: 0 },
  { id: 'num', name: 'n', type: 'number', options: {}, createdAt: 1 },
  { id: 'sel', name: 's', type: 'select', options: { choices }, createdAt: 2 },
]
const NOW = Date.UTC(2026, 10, 27)

const arbRow = fc
  .record({
    id: fc.constantFrom(...Array.from({ length: 12 }, (_, i) => `r${i}`)),
    order: fc.constantFrom('a0', 'a1', 'a2', 'a3'),
    text: fc.option(fc.constantFrom('', 'x', 'xy', 'Y'), { nil: undefined }),
    num: fc.option(fc.integer({ min: 0, max: 4 }), { nil: undefined }),
    sel: fc.option(fc.constantFrom('o1', 'o2'), { nil: undefined }),
  })
  .map(({ id, order, ...cells }): RowSnapshot => {
    const c: Record<string, CellValue> = {}
    for (const [k, v] of Object.entries(cells)) if (v !== undefined) c[k] = v
    return {
      id,
      order,
      cells: c,
      icon: null,
      cover: null,
      hasDoc: false,
      createdAt: 0,
      createdBy: '',
      updatedAt: 0,
      updatedBy: '',
    }
  })
const arbOp = fc.oneof(
  fc.record({ upsert: arbRow }),
  fc.record({ del: fc.constantFrom(...Array.from({ length: 12 }, (_, i) => `r${i}`)) }),
)
const arbFilter = fc.option(
  fc.constantFrom<FilterGroup>(
    { op: 'and', items: [{ id: 'f', fieldId: 'text', cond: 'contains', value: 'x' }] },
    {
      op: 'or',
      items: [
        { id: 'f', fieldId: 'num', cond: 'gte', value: 2 },
        { id: 'g', fieldId: 'sel', cond: 'isEmpty' },
      ],
    },
  ),
  { nil: null },
)
const arbSorts = fc.constantFrom<Sort[]>(
  [],
  [{ id: 's', fieldId: 'num', dir: 'desc' }],
  [
    { id: 's', fieldId: 'sel', dir: 'asc' },
    { id: 't', fieldId: 'text', dir: 'asc' },
  ],
)

const arbGroup = fc.constantFrom<GroupSettings | null>(
  null,
  { fieldId: 'sel', hideEmpty: false, order: {}, hidden: [] },
  { fieldId: 'sel', hideEmpty: true, order: { o2: 'a0', o1: 'a1' }, hidden: ['o1'] },
)

describe('incremental query (spec/05 §2, M4-04)', () => {
  it('after any sequence of row changes the result equals a full recompute', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(arbRow, { selector: (r) => r.id }),
        fc.array(arbOp, { maxLength: 25 }),
        arbFilter,
        arbSorts,
        arbGroup,
        (initial, ops, filter, sorts, group) => {
          // M5-02: board groups follow incrementally too
          const view = { filter, sorts, group, calcs: { num: 'sum' as const, text: 'countEmpty' as const } }
          const live = createLiveQuery({ fields: FIELDS, rows: initial, view, now: NOW })
          const rows = new Map(initial.map((r) => [r.id, r]))
          for (const op of ops) {
            if ('upsert' in op) {
              rows.set(op.upsert.id, op.upsert)
              live.apply({ upserts: [op.upsert] })
            } else {
              rows.delete(op.del)
              live.apply({ deletes: [op.del] })
            }
            expect(live.result()).toEqual(runQuery({ fields: FIELDS, rows: [...rows.values()], view, now: NOW }))
          }
        },
      ),
    )
  })

  it('setQuery recomputes with new settings', () => {
    fc.assert(
      fc.property(fc.uniqueArray(arbRow, { selector: (r) => r.id }), arbFilter, arbSorts, (rows, filter, sorts) => {
        const live = createLiveQuery({ fields: FIELDS, rows, view: { filter: null, sorts: [] }, now: NOW })
        live.setQuery({ fields: FIELDS, view: { filter, sorts }, now: NOW, search: 'x' })
        expect(live.result()).toEqual(
          runQuery({ fields: FIELDS, rows, view: { filter, sorts }, now: NOW, search: 'x' }),
        )
      }),
    )
  })
})

describe('observeRows / observeSchema', () => {
  function setup() {
    const db: DbDocs = { schema: new Y.Doc(), shards: Array.from({ length: SHARD_COUNT }, () => new Y.Doc()) }
    createDatabase(new Y.Doc(), db, { dbId: 'd', primaryName: 'Name' })
    return db
  }

  it('reports exactly the changed row ids, and a live query fed by it stays correct', () => {
    const db = setup()
    const primary = listFields(db)[0]!
    const a = addRow(db, { cells: { [primary.id]: 'b' } })
    const b = addRow(db, { cells: { [primary.id]: 'a' } })
    const view = { filter: null, sorts: [{ id: 's', fieldId: primary.id, dir: 'asc' as const }] }
    const live = createLiveQuery({ fields: listFields(db), rows: listRows(db), view, now: NOW })
    const seen: string[][] = []
    const off = observeRows(db, (ids) => {
      seen.push([...ids])
      const upserts = [...ids].map((id) => getRow(db, id)).filter((r): r is RowSnapshot => !!r)
      live.apply({ upserts, deletes: [...ids].filter((id) => !getRow(db, id)) })
    })
    expect(live.result().rowIds).toEqual([b, a])
    setCell(db, a, primary.id, '0')
    expect(seen.at(-1)).toEqual([a])
    expect(live.result().rowIds).toEqual([a, b])
    const c = addRow(db, { cells: { [primary.id]: 'c' } })
    moveRow(db, b, { afterId: c })
    deleteRows(db, [a])
    expect(live.result().rowIds).toEqual([b, c])
    expect(live.result()).toEqual(runQuery({ fields: listFields(db), rows: listRows(db), view, now: NOW }))
    off()
    setCell(db, b, primary.id, 'z')
    expect(live.result().rowIds).toEqual([b, c]) // no longer observed
  })

  it('schema changes are reported for a full recompute', () => {
    const db = setup()
    let n = 0
    const off = observeSchema(db, () => n++)
    const f = addField(db, { name: 'N', type: 'number' })
    renameField(db, f, 'M')
    expect(n).toBe(2)
    off()
  })
})
