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
  getField,
  getRow,
  linkRow,
  liveRelationIds,
  readDbMeta,
  relationIds,
  relationOptions,
  relationTitles,
  setCell,
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
