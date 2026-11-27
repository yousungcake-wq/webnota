import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { convertField, convertValue, planConversion } from './convert'
import { choicesOf } from './cells'
import {
  addField,
  addRow,
  createDatabase,
  getField,
  getRow,
  setCell,
  PrimaryFieldError,
  readDbMeta,
  type DbDocs,
} from './model'
import { SHARD_COUNT } from './shard'
import type { FieldMeta, FieldType, SelectChoice } from './types'

const F = (type: FieldType, options = {}): FieldMeta => ({ id: 'f', name: 'f', type, options, createdAt: 0 })
const sel = [
  { id: 'a', name: 'Apple', color: 'red' },
  { id: 'b', name: 'Banana', color: 'yellow' },
]
const conv = (from: FieldMeta, to: FieldType, v: unknown, choices: SelectChoice[] = []) =>
  convertValue(from, to, v, choices)

describe('type conversion rules (spec/05 §3.4)', () => {
  it('any type → text: the displayed text', () => {
    expect(conv(F('number'), 'text', 12.5)).toBe('12.5')
    expect(conv(F('select', { choices: sel }), 'text', 'b')).toBe('Banana')
    expect(conv(F('multiSelect', { choices: sel }), 'text', ['a', 'b'])).toBe('Apple, Banana')
    expect(conv(F('date'), 'text', { start: new Date(2026, 0, 2).getTime(), includeTime: false })).toBe('2026-01-02')
    expect(conv(F('checkbox'), 'text', true)).toBe('true')
    expect(conv(F('checkbox'), 'text', false)).toBeUndefined()
    expect(conv(F('url'), 'text', 'https://x.y')).toBe('https://x.y')
    expect(conv(F('time'), 'text', 90)).toBe('1h 30m')
    expect(conv(F('checklist'), 'text', [{ id: '1', name: 'a', done: true }])).toBe('a')
    expect(conv(F('media'), 'text', [{ fileId: 'x', name: 'p.png', mime: '', size: 1 }])).toBe('p.png')
    expect(conv(F('createdTime'), 'text', new Date(2026, 0, 2, 3, 4).getTime())).toBe('2026-01-02 03:04')
  })
  it('text → number: parseFloat, else empty', () => {
    expect(conv(F('text'), 'number', '1,200')).toBe(1200)
    expect(conv(F('text'), 'number', '12kg')).toBe(12)
    expect(conv(F('text'), 'number', 'abc')).toBeUndefined()
  })
  it('text → select / multi-select creates options (comma split only for multi)', () => {
    const choices: SelectChoice[] = []
    expect(conv(F('text'), 'select', 'a, b', choices)).toBe(choices[0]!.id)
    expect(choices.map((c) => c.name)).toEqual(['a, b'])
    const multi: SelectChoice[] = []
    const ids = conv(F('text'), 'multiSelect', 'x, y, x', multi) as string[]
    expect(multi.map((c) => c.name)).toEqual(['x', 'y'])
    expect(ids).toEqual(multi.map((c) => c.id))
  })
  it('select ↔ multi-select: single ↔ array (multi → select keeps the first)', () => {
    expect(conv(F('select', { choices: sel }), 'multiSelect', 'a', [...sel])).toEqual(['a'])
    expect(conv(F('multiSelect', { choices: sel }), 'select', ['b', 'a'], [...sel])).toBe('b')
  })
  it('text / number → date: ISO, dotted and dashed dates', () => {
    expect(conv(F('text'), 'date', '2026.03.04')).toEqual({ start: new Date(2026, 2, 4).getTime(), includeTime: false })
    expect(conv(F('text'), 'date', '2026-03-04')).toEqual({ start: new Date(2026, 2, 4).getTime(), includeTime: false })
    expect(conv(F('number'), 'date', 1000)).toEqual({ start: 1000, includeTime: false })
    expect(conv(F('text'), 'date', 'soon')).toBeUndefined()
  })
  it('checkbox ↔ text: true/yes/1/✓', () => {
    for (const w of ['true', 'Yes', '1', '✓']) expect(conv(F('text'), 'checkbox', w)).toBe(true)
    expect(conv(F('text'), 'checkbox', 'no')).toBeUndefined()
  })
  it('everything else empties the value', () => {
    expect(conv(F('number'), 'checkbox', 1)).toBeUndefined()
    expect(conv(F('date'), 'number', { start: 1, includeTime: false })).toBeUndefined()
    expect(conv(F('checkbox'), 'select', true)).toBeUndefined()
    expect(conv(F('media'), 'url', [{ fileId: 'x', name: 'n', mime: '', size: 1 }])).toBe('n') // via text
  })
  it('number ↔ time keep the number (minutes)', () => {
    expect(conv(F('number'), 'time', 30)).toBe(30)
    expect(conv(F('time'), 'number', 30)).toBe(30)
  })
})

function setup() {
  const db: DbDocs = { schema: new Y.Doc(), shards: Array.from({ length: SHARD_COUNT }, () => new Y.Doc()) }
  createDatabase(new Y.Doc(), db, { dbId: 'd', primaryName: 'Name' })
  return db
}

describe('convertField', () => {
  it('counts lost cells, converts every row and undoes (keeping later edits)', () => {
    const db = setup()
    const f = addField(db, { name: 'T', type: 'text' })
    const r1 = addRow(db, { cells: { [f]: '12' } })
    const r2 = addRow(db, { cells: { [f]: 'abc' } })
    const r3 = addRow(db, { cells: { [f]: '7' } })
    addRow(db)
    expect(planConversion(db, f, 'number').lostCount).toBe(1)
    const undo = convertField(db, f, 'number')!
    expect(getField(db, f)!.type).toBe('number')
    expect([r1, r2, r3].map((r) => getRow(db, r)!.cells[f])).toEqual([12, undefined, 7])
    setCell(db, r3, f, 99) // edited after converting
    undo()
    expect(getField(db, f)!.type).toBe('text')
    expect([r1, r2, r3].map((r) => getRow(db, r)!.cells[f])).toEqual(['12', 'abc', 99])
  })
  it('text → select builds the option list; undo removes it', () => {
    const db = setup()
    const f = addField(db, { name: 'T', type: 'text' })
    addRow(db, { cells: { [f]: 'Red' } })
    addRow(db, { cells: { [f]: 'Blue' } })
    addRow(db, { cells: { [f]: 'Red' } })
    const undo = convertField(db, f, 'select')!
    expect(choicesOf(getField(db, f)!).map((c) => c.name)).toEqual(['Red', 'Blue'])
    undo()
    expect(getField(db, f)!.options.choices).toBeUndefined()
  })
  it('select → multi keeps unused options; created time → date fills from the row', () => {
    const db = setup()
    const f = addField(db, { name: 'S', type: 'select', options: { choices: sel } })
    const r = addRow(db, { cells: { [f]: 'a' } })
    convertField(db, f, 'multiSelect')
    expect(choicesOf(getField(db, f)!)).toEqual(sel)
    expect(getRow(db, r)!.cells[f]).toEqual(['a'])
    const c = addField(db, { name: 'C', type: 'createdTime' })
    expect(planConversion(db, c, 'date').lostCount).toBe(0)
    convertField(db, c, 'date')
    expect(getRow(db, r)!.cells[c]).toEqual({ start: getRow(db, r)!.createdAt, includeTime: true })
  })
  it('refuses the primary field', () => {
    const db = setup()
    expect(() => convertField(db, readDbMeta(db).primaryFieldId, 'number')).toThrow(PrimaryFieldError)
  })
})
