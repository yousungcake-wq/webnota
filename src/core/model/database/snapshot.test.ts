import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { addField, addRow, createDatabase, listFields, listRows, readViewSettings, setCalc, type DbDocs } from './model'
import { SHARD_COUNT } from './shard'
import { importCsvRows, inferColumn, restoreDatabase, snapshotDatabase } from './snapshot'

const docs = (): DbDocs => ({ schema: new Y.Doc(), shards: Array.from({ length: SHARD_COUNT }, () => new Y.Doc()) })

describe('database snapshot (lossless export, feedback 11)', () => {
  it('restores fields, view settings (re-keyed) and rows exactly', () => {
    const a = docs()
    const { viewId } = createDatabase(new Y.Doc(), a, { dbId: 'd', primaryName: 'Name' })
    const n = addField(a, { name: 'N', type: 'number', options: { format: 'currency', currency: 'KRW' } })
    addRow(a, { cells: { [n]: 5 } })
    setCalc(a, viewId, n, 'sum')
    const snap = JSON.parse(JSON.stringify(snapshotDatabase(a)))
    const b = docs()
    restoreDatabase(b, snap, new Map([[viewId, 'newView']]))
    expect(listFields(b)).toEqual(listFields(a))
    expect(listRows(b)).toEqual(listRows(a))
    expect(readViewSettings(b, 'newView')).toEqual({ ...readViewSettings(a, viewId), id: 'newView' })
  })
})

describe('CSV column types (Notion import)', () => {
  it('infers number, checkbox, date, url, select, multi-select, text', () => {
    expect(inferColumn(['1', '2.5', '']).type).toBe('number')
    expect(inferColumn(['Yes', 'No', 'Yes']).values).toEqual([true, undefined, true])
    expect(inferColumn(['November 27, 2026', '2026/01/02']).type).toBe('date')
    expect(inferColumn(['https://a.b', '']).type).toBe('url')
    const sel = inferColumn(['Todo', 'Done', 'Todo'])
    expect(sel.type).toBe('select')
    expect(sel.options.choices!.map((c) => c.name)).toEqual(['Todo', 'Done'])
    const multi = inferColumn(['a, b', 'b'])
    expect(multi.type).toBe('multiSelect')
    expect((multi.values[0] as string[]).length).toBe(2)
    expect(inferColumn(['hello', 'world']).type).toBe('text')
  })
  it('reads Notion date ranges and times (M8-04)', () => {
    const c = inferColumn(['June 1, 2024 → June 3, 2024', 'June 5, 2024 10:30 AM', ''])
    expect(c.type).toBe('date')
    const [a, b] = c.values as { start: number; end?: number; includeTime: boolean }[]
    expect(a!.end! - a!.start).toBe(2 * 86400000)
    expect(a!.includeTime).toBe(false)
    expect(b!.includeTime).toBe(true)
    expect(b!.end).toBeUndefined()
  })
  it('imports rows with the first column as the title', () => {
    const db = docs()
    createDatabase(new Y.Doc(), db, { dbId: 'd', primaryName: 'Name' })
    const n = importCsvRows(
      db,
      ['Name', 'Qty', 'Done'],
      [
        ['A', '1', 'Yes'],
        ['B', '2', 'No'],
      ],
      (name, col) => addField(db, { name, type: col.type, options: col.options }),
    )
    expect(n).toBe(2)
    // fields created in the same millisecond sort by id: compare without order
    expect(
      listFields(db)
        .map((f) => [f.name, f.type])
        .sort(),
    ).toEqual([
      ['Done', 'checkbox'],
      ['Name', 'text'],
      ['Qty', 'number'],
    ])
    expect(listRows(db).map((r) => Object.values(r.cells))).toEqual([
      ['A', 1, true],
      ['B', 2],
    ])
  })
})
