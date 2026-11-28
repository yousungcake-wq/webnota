import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { SHARD_COUNT } from './shard'
import {
  addField,
  addRelationField,
  addRow,
  computeRollup,
  createDatabase,
  deleteRows,
  getField,
  getRow,
  listFields,
  readDbMeta,
  rollupFns,
  rollupOptions,
  setRelation,
  type DbDocs,
} from './index'

const docs = (): DbDocs => ({ schema: new Y.Doc(), shards: Array.from({ length: SHARD_COUNT }, () => new Y.Doc()) })

function setup() {
  const ws = new Y.Doc()
  ws.getMap('spaces').set('s', new Y.Map())
  const projects = docs()
  const tasks = docs()
  createDatabase(ws, projects, { dbId: 'projects', primaryName: 'Name', spaceId: 's' })
  createDatabase(ws, tasks, { dbId: 'tasks', primaryName: 'Name', spaceId: 's' })
  const rel = addRelationField(projects, { name: 'Tasks', targetDatabaseId: 'tasks' })
  const hours = addField(tasks, { name: 'Hours', type: 'number' })
  const done = addField(tasks, { name: 'Done', type: 'checkbox' })
  const name = readDbMeta(tasks).primaryFieldId
  const t = [
    addRow(tasks, { cells: { [name]: 'A', [hours]: 2, [done]: true } }),
    addRow(tasks, { cells: { [name]: 'B', [hours]: 3 } }),
    addRow(tasks, { cells: { [name]: 'A', [hours]: 5, [done]: true } }),
  ]
  const p = addRow(projects)
  setRelation(projects, p, rel, t)
  const rollup = (options: Record<string, unknown>) =>
    getField(
      projects,
      addField(projects, { name: 'R', type: 'rollup', options: { relationFieldId: rel, ...options } }),
    )!
  const value = (f: ReturnType<typeof rollup>) => computeRollup(f, getRow(projects, p)!, listFields(projects), tasks)
  return { projects, tasks, rel, hours, done, name, t, p, rollup, value }
}

describe('rollups (M6-04)', () => {
  it('lists original or distinct values of the target field (default: the title)', () => {
    const { rollup, value, name } = setup()
    expect(value(rollup({}))).toEqual({ kind: 'list', items: ['A', 'B', 'A'] })
    expect(value(rollup({ fn: 'unique', targetFieldId: name }))).toEqual({ kind: 'list', items: ['A', 'B'] })
  })

  it('calculates with the target field type; deleted targets drop out', () => {
    const { rollup, value, hours, done, tasks, t } = setup()
    const sum = rollup({ targetFieldId: hours, fn: 'sum' })
    expect(value(sum)).toMatchObject({ kind: 'calc', result: { calc: 'sum', value: 10 } })
    expect(value(rollup({ targetFieldId: hours, fn: 'average' }))).toMatchObject({ result: { value: 10 / 3 } })
    expect(value(rollup({ targetFieldId: done, fn: 'percentChecked' }))).toMatchObject({
      result: { value: (2 / 3) * 100 },
    })
    expect(value(rollup({ targetFieldId: hours, fn: 'count' }))).toMatchObject({ result: { value: 3 } })
    // a calculation the type does not have → nothing
    expect(value(rollup({ targetFieldId: done, fn: 'sum' }))).toBeNull()
    deleteRows(tasks, [t[2]!])
    expect(value(sum)).toMatchObject({ result: { value: 5 } })
  })

  it('no relation field or no target docs → nothing; options and functions', () => {
    const { projects, tasks, hours, rollup, p } = setup()
    const f = getField(
      projects,
      addField(projects, { name: 'R2', type: 'rollup', options: { relationFieldId: 'gone' } }),
    )!
    expect(computeRollup(f, getRow(projects, p)!, listFields(projects), tasks)).toBeNull()
    expect(computeRollup(rollup({}), getRow(projects, p)!, listFields(projects), null)).toBeNull()
    expect(rollupOptions(f)).toEqual({ relationFieldId: 'gone', targetFieldId: null, fn: 'showOriginal' })
    expect(rollupFns(getField(tasks, hours)!)).toContain('sum')
    expect(rollupFns(getField(tasks, hours)!).slice(0, 2)).toEqual(['showOriginal', 'unique'])
  })
})
