import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { parseCSV } from '../../io/csv'
import { SHARD_COUNT } from './shard'
import {
  addField,
  choicesOf,
  columnAs,
  createDatabase,
  getField,
  importCsv,
  listFields,
  listRows,
  planCsv,
  readDbMeta,
  type DbDocs,
} from './index'

const docs = (): DbDocs => ({ schema: new Y.Doc(), shards: Array.from({ length: SHARD_COUNT }, () => new Y.Doc()) })
const csv =
  'Name,Hours,Status,Tags,Due,Done,Link\r\n"A, inc",2,Todo,"x, y",2026-11-27,yes,https://a.b\r\nB,"1,500",Done,y,"November 3, 2026",no,\r\nC,,Todo,,,,\r\n'

describe('CSV import (M6-06)', () => {
  it('plans types by inference; column 0 is the title', () => {
    const [header, ...records] = parseCSV(csv)
    expect(planCsv(header!, records).map((p) => [p.name, p.type, p.fieldId])).toEqual([
      ['Name', 'text', 'primary'],
      ['Hours', 'number', undefined],
      ['Status', 'select', undefined],
      ['Tags', 'multiSelect', undefined],
      ['Due', 'date', undefined],
      ['Done', 'checkbox', undefined],
      ['Link', 'url', undefined],
    ])
  })

  it('imports into a new database with the planned (or overridden) types', () => {
    const db = docs()
    createDatabase(new Y.Doc(), db, { dbId: 'd', primaryName: 'Name' })
    const [header, ...records] = parseCSV(csv)
    const plan = planCsv(header!, records)
    plan[1] = { ...plan[1]!, type: 'text' } // keep "1,500" as written
    plan.splice(6, 1) // skip Link
    expect(importCsv(db, records, plan)).toBe(3)
    const fields = listFields(db)
    expect(Object.fromEntries(fields.map((f) => [f.name, f.type]))).toEqual({
      Name: 'text',
      Hours: 'text',
      Status: 'select',
      Tags: 'multiSelect',
      Due: 'date',
      Done: 'checkbox',
    })
    const rows = listRows(db)
    const byName = (n: string) => fields.find((f) => f.name === n)!.id
    expect(rows.map((r) => r.cells[readDbMeta(db).primaryFieldId])).toEqual(['A, inc', 'B', 'C'])
    expect(rows[1]!.cells[byName('Hours')]).toBe('1,500')
    expect(choicesOf(fields.find((f) => f.name === 'Tags')!).map((c) => c.name)).toEqual(['x', 'y'])
    expect(rows[0]!.cells[byName('Done')]).toBe(true)
    expect(rows[1]!.cells[byName('Due')]).toMatchObject({ start: new Date(2026, 10, 3).getTime() })
  })

  it('appends to an existing database: columns map onto fields, new options are added', () => {
    const db = docs()
    createDatabase(new Y.Doc(), db, { dbId: 'd', primaryName: 'Name' })
    const status = addField(db, {
      name: 'Status',
      type: 'select',
      options: { choices: [{ id: 'todo', name: 'Todo', color: 'gray' }] },
    })
    const [, ...records] = parseCSV(csv)
    importCsv(db, records, [
      { index: 0, name: 'Name', type: 'text', fieldId: 'primary' },
      { index: 2, name: 'Status', type: 'select', fieldId: status },
    ])
    const field = getField(db, status)!
    expect(choicesOf(field).map((c) => c.name)).toEqual(['Todo', 'Done'])
    expect(listRows(db).map((r) => r.cells[status])).toEqual(['todo', choicesOf(field)[1]!.id, 'todo'])
    expect(columnAs(['1', 'x'], 'number').values).toEqual([1, undefined])
  })
})
