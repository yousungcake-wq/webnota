import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createView } from '../views'
import { SHARD_COUNT } from './shard'
import {
  addRelationField,
  addRow,
  createDatabase,
  databaseSpaceId,
  deleteRows,
  disableTwoWay,
  enableTwoWay,
  getField,
  getRow,
  linkRow,
  liveRelationIds,
  readDbMeta,
  relationIds,
  relationOptions,
  relationTitles,
  repairTwoWay,
  setCell,
  setLinks,
  setRelation,
  unlinkRow,
  type DbDocs,
} from './index'

const docs = (): DbDocs => ({ schema: new Y.Doc(), shards: Array.from({ length: SHARD_COUNT }, () => new Y.Doc()) })

function setup() {
  const ws = new Y.Doc()
  ws.getMap('spaces').set('s1', new Y.Map())
  ws.getMap('spaces').set('s2', new Y.Map())
  const tasks = docs()
  const people = docs()
  createDatabase(ws, tasks, { dbId: 'tasks', primaryName: 'Name', spaceId: 's1' })
  createDatabase(ws, people, { dbId: 'people', primaryName: 'Name', spaceId: 's2' })
  return { ws, tasks, people }
}

describe('relation fields (M6-01)', () => {
  it('stores target ids, deduplicated; link / unlink / set', () => {
    const { tasks, people } = setup()
    const f = addRelationField(tasks, { name: 'Owner', targetDatabaseId: 'people' })
    expect(relationOptions(getField(tasks, f)!)).toEqual({
      targetDatabaseId: 'people',
      twoWay: false,
      pairedFieldId: null,
    })
    const t = addRow(tasks)
    const a = addRow(people, { cells: { [readDbMeta(people).primaryFieldId]: 'Ann' } })
    const b = addRow(people, { cells: { [readDbMeta(people).primaryFieldId]: 'Bob' } })
    linkRow(tasks, t, f, a)
    linkRow(tasks, t, f, b)
    linkRow(tasks, t, f, a)
    expect(getRow(tasks, t)!.cells[f]).toEqual([a, b])
    unlinkRow(tasks, t, f, a)
    expect(getRow(tasks, t)!.cells[f]).toEqual([b])
    setRelation(tasks, t, f, [a, a, b])
    expect(relationIds(getRow(tasks, t)!.cells[f])).toEqual([a, b])
    setRelation(tasks, t, f, [])
    expect(getRow(tasks, t)!.cells[f]).toBeUndefined()
  })

  it('titles in cell order; deleted target rows read as gone', () => {
    const { tasks, people } = setup()
    const f = addRelationField(tasks, { name: 'Owner', targetDatabaseId: 'people' })
    const name = readDbMeta(people).primaryFieldId
    const a = addRow(people, { cells: { [name]: 'Ann' } })
    const b = addRow(people, { cells: { [name]: 'Bob' } })
    const t = addRow(tasks)
    setRelation(tasks, t, f, [b, a])
    expect(relationTitles(people, [b, a, 'nope'])).toEqual([
      { id: b, title: 'Bob' },
      { id: a, title: 'Ann' },
    ])
    deleteRows(people, [b])
    const row = getRow(tasks, t)!
    expect(liveRelationIds(getField(tasks, f)!, row, (id) => !!getRow(people, id))).toEqual([a])
    expect(relationIds(['x', 3, 'x', null])).toEqual(['x'])
  })

  it('a relation to the same database works; non-string garbage is ignored', () => {
    const { tasks } = setup()
    const f = addRelationField(tasks, { name: 'Parent', targetDatabaseId: 'tasks' })
    const p = addRow(tasks)
    const c = addRow(tasks)
    setCell(tasks, c, f, [p, 7 as unknown as string])
    expect(relationIds(getRow(tasks, c)!.cells[f])).toEqual([p])
  })

  it('tells which space a database lives in (spaces → repositories in M9)', () => {
    const { ws } = setup()
    expect(databaseSpaceId(ws, 'tasks')).toBe('s1')
    expect(databaseSpaceId(ws, 'people')).toBe('s2')
    expect(databaseSpaceId(ws, 'none')).toBe('')
    const page = createView(ws, { spaceId: 's2' })
    createView(ws, { parentId: page, kind: 'database', layout: 'grid', databaseId: 'inline', embedded: true })
    expect(databaseSpaceId(ws, 'inline')).toBe('s2')
  })
})

describe('two-way relations (M6-03)', () => {
  const name = (db: DbDocs) => readDbMeta(db).primaryFieldId
  function pair() {
    const { tasks, people } = setup()
    const f = addRelationField(tasks, { name: 'Owner', targetDatabaseId: 'people' })
    const t1 = addRow(tasks, { cells: { [name(tasks)]: 'T1' } })
    const t2 = addRow(tasks, { cells: { [name(tasks)]: 'T2' } })
    const ann = addRow(people, { cells: { [name(people)]: 'Ann' } })
    const bob = addRow(people, { cells: { [name(people)]: 'Bob' } })
    return { tasks, people, f, t1, t2, ann, bob }
  }

  it('enabling creates the paired field and mirrors existing links; edits follow both ways', () => {
    const { tasks, people, f, t1, t2, ann, bob } = pair()
    setRelation(tasks, t1, f, [ann])
    const p = enableTwoWay(tasks, people, f, { selfId: 'tasks', targetId: 'people', pairedName: 'Tasks' })
    expect(relationOptions(getField(people, p)!)).toEqual({ targetDatabaseId: 'tasks', twoWay: true, pairedFieldId: f })
    expect(relationOptions(getField(tasks, f)!).pairedFieldId).toBe(p)
    expect(getRow(people, ann)!.cells[p]).toEqual([t1])
    // enabling twice reuses the pair
    expect(enableTwoWay(tasks, people, f, { selfId: 'tasks', targetId: 'people', pairedName: 'X' })).toBe(p)

    setLinks(tasks, people, f, t2, [ann, bob])
    expect(getRow(people, ann)!.cells[p]).toEqual([t1, t2])
    expect(getRow(people, bob)!.cells[p]).toEqual([t2])
    setLinks(tasks, people, f, t2, [bob])
    expect(getRow(people, ann)!.cells[p]).toEqual([t1])
    // from the other side
    setLinks(people, tasks, p, bob, [])
    expect(getRow(tasks, t2)!.cells[f]).toBeUndefined()

    disableTwoWay(tasks, people, f)
    expect(relationOptions(getField(people, p)!).twoWay).toBe(false)
    setLinks(tasks, people, f, t1, [ann, bob])
    expect(getRow(people, bob)!.cells[p]).toBeUndefined() // one-way now
  })

  it('within one database the pair is another field of the same database', () => {
    const { tasks } = setup()
    const f = addRelationField(tasks, { name: 'Blocks', targetDatabaseId: 'tasks' })
    const a = addRow(tasks)
    const b = addRow(tasks)
    const p = enableTwoWay(tasks, tasks, f, { selfId: 'tasks', targetId: 'tasks', pairedName: 'Blocked by' })
    setLinks(tasks, tasks, f, a, [b])
    expect(getRow(tasks, b)!.cells[p]).toEqual([a])
  })

  it('after any concurrent edits on two devices, repair makes both sides agree (property)', () => {
    const clone = (db: DbDocs): DbDocs => {
      const c = docs()
      Y.applyUpdate(c.schema, Y.encodeStateAsUpdate(db.schema))
      db.shards.forEach((s, i) => Y.applyUpdate(c.shards[i]!, Y.encodeStateAsUpdate(s)))
      return c
    }
    const merge = (x: DbDocs, y: DbDocs) => {
      const all: [Y.Doc, Y.Doc][] = [
        [x.schema, y.schema],
        ...x.shards.map((s, i) => [s, y.shards[i]!] as [Y.Doc, Y.Doc]),
      ]
      for (const [a, b] of all) {
        Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
        Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
      }
    }
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            device: fc.constantFrom(0, 1),
            side: fc.constantFrom('tasks', 'people'),
            row: fc.integer({ min: 0, max: 1 }),
            links: fc.subarray([0, 1]),
          }),
          { maxLength: 12 },
        ),
        (ops) => {
          const { tasks, people, f, t1, t2, ann, bob } = pair()
          const p = enableTwoWay(tasks, people, f, { selfId: 'tasks', targetId: 'people', pairedName: 'Tasks' })
          const devices = [
            { tasks, people },
            { tasks: clone(tasks), people: clone(people) },
          ]
          const T = [t1, t2]
          const P = [ann, bob]
          for (const op of ops) {
            const d = devices[op.device]!
            if (op.side === 'tasks')
              setLinks(
                d.tasks,
                d.people,
                f,
                T[op.row]!,
                op.links.map((i) => P[i]!),
              )
            else
              setLinks(
                d.people,
                d.tasks,
                p,
                P[op.row]!,
                op.links.map((i) => T[i]!),
              )
          }
          merge(devices[0]!.tasks, devices[1]!.tasks)
          merge(devices[0]!.people, devices[1]!.people)
          repairTwoWay(tasks, people, f)
          for (const t of T)
            for (const id of relationIds(getRow(tasks, t)!.cells[f]))
              expect(relationIds(getRow(people, id)!.cells[p])).toContain(t)
          for (const x of P)
            for (const id of relationIds(getRow(people, x)!.cells[p]))
              expect(relationIds(getRow(tasks, id)!.cells[f])).toContain(x)
          expect(repairTwoWay(tasks, people, f)).toBe(0)
        },
      ),
    )
  })
})
