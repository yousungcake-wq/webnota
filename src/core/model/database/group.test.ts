import { describe, expect, it } from 'vitest'
import {
  dateGroupKey,
  dateOfGroupKey,
  defaultGroupField,
  groupFieldOf,
  groupKeysOf,
  groupRows,
  NO_VALUE,
  orderGroupKeys,
} from './group'
import { runQuery } from './query'
import type { CellValue, FieldMeta, FieldType, GroupSettings, RowSnapshot } from './types'

const choices = [
  { id: 'o1', name: 'A', color: 'gray' },
  { id: 'o2', name: 'B', color: 'blue' },
  { id: 'o3', name: 'C', color: 'red' },
]
const field = (type: FieldType, id = type): FieldMeta => ({
  id,
  name: id,
  type,
  options: type === 'select' || type === 'multiSelect' ? { choices } : {},
  createdAt: 0,
})
const row = (id: string, cells: Record<string, CellValue>, order = 'a0'): RowSnapshot => ({
  id,
  order,
  cells,
  icon: null,
  cover: null,
  hasDoc: false,
  createdAt: 0,
  createdBy: '',
  updatedAt: 0,
  updatedBy: '',
})
const S: GroupSettings = { fieldId: '', hideEmpty: false, order: {}, hidden: [] }
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()

describe('group keys (M5-02, DB-K01)', () => {
  it('select: option id, deleted or missing option → no value', () => {
    const f = field('select')
    expect(groupKeysOf(f, row('r', { select: 'o2' }), S)).toEqual(['o2'])
    expect(groupKeysOf(f, row('r', { select: 'gone' }), S)).toEqual([NO_VALUE])
    expect(groupKeysOf(f, row('r', {}), S)).toEqual([NO_VALUE])
  })
  it('multiSelect: one key per option; empty → no value', () => {
    const f = field('multiSelect')
    expect(groupKeysOf(f, row('r', { multiSelect: ['o3', 'o1', 'gone'] }), S)).toEqual(['o3', 'o1'])
    expect(groupKeysOf(f, row('r', { multiSelect: [] }), S)).toEqual([NO_VALUE])
  })
  it('checkbox: true / false, never empty', () => {
    const f = field('checkbox')
    expect(groupKeysOf(f, row('r', { checkbox: true }), S)).toEqual(['true'])
    expect(groupKeysOf(f, row('r', {}), S)).toEqual(['false'])
    expect(groupKeysOf(f, row('r', { checkbox: 'yes' }), S)).toEqual(['false'])
  })
  it('date: day / week / month (default) / year in local time', () => {
    const f = field('date')
    const ts = local(2026, 11, 27) // a Friday
    const r = row('r', { date: { start: ts, includeTime: false } })
    expect(groupKeysOf(f, r, S)).toEqual(['m:2026-11'])
    expect(groupKeysOf(f, r, { ...S, dateUnit: 'day' })).toEqual(['d:2026-11-27'])
    expect(groupKeysOf(f, r, { ...S, dateUnit: 'week' })).toEqual(['w:2026-11-22']) // Sunday start
    expect(groupKeysOf(f, r, { ...S, dateUnit: 'week' }, 1)).toEqual(['w:2026-11-23']) // Monday start
    expect(groupKeysOf(f, r, { ...S, dateUnit: 'year' })).toEqual(['y:2026'])
    expect(groupKeysOf(f, row('r', {}), S)).toEqual([NO_VALUE])
    // a week across a year boundary
    expect(dateGroupKey(local(2027, 1, 1), 'week')).toBe('w:2026-12-27')
    expect(dateOfGroupKey('w:2026-12-27')).toBe(new Date(2026, 11, 27).getTime())
    expect(dateOfGroupKey('m:2026-11')).toBe(new Date(2026, 10, 1).getTime())
    expect(dateOfGroupKey('y:2026')).toBe(new Date(2026, 0, 1).getTime())
    expect(dateOfGroupKey('')).toBeNull()
  })
  it('url: trimmed address', () => {
    const f = field('url')
    expect(groupKeysOf(f, row('r', { url: ' https://a.b ' }), S)).toEqual(['https://a.b'])
    expect(groupKeysOf(f, row('r', { url: '  ' }), S)).toEqual([NO_VALUE])
  })
  it('other types do not group', () => {
    expect(groupFieldOf([field('text')], { ...S, fieldId: 'text' })).toBeNull()
    expect(groupFieldOf([field('select')], { ...S, fieldId: 'select' })?.id).toBe('select')
    expect(groupFieldOf([field('select')], null)).toBeNull()
    expect(defaultGroupField([field('text'), field('checkbox'), field('multiSelect')])?.id).toBe('multiSelect')
    expect(defaultGroupField([field('text')])).toBeNull()
  })
})

describe('column order', () => {
  it('select: no value first, then every option (empty ones too) in option order', () => {
    expect(orderGroupKeys(field('select'), ['o3'], S)).toEqual([NO_VALUE, 'o1', 'o2', 'o3'])
  })
  it('checkbox unchecked first; dates oldest first; urls alphabetical', () => {
    expect(orderGroupKeys(field('checkbox'), [], S)).toEqual(['false', 'true'])
    expect(orderGroupKeys(field('date'), ['m:2026-12', NO_VALUE, 'm:2025-01'], S)).toEqual([
      NO_VALUE,
      'm:2025-01',
      'm:2026-12',
    ])
    expect(orderGroupKeys(field('url'), ['b', 'a'], S)).toEqual(['a', 'b'])
  })
  it('stored order wins; keys without one follow in natural order', () => {
    expect(orderGroupKeys(field('select'), [], { order: { o3: 'a0', o1: 'a1' } })).toEqual(['o3', 'o1', NO_VALUE, 'o2'])
  })
})

describe('groupRows / runQuery groups', () => {
  it('keeps the query order inside columns; multi rows appear in each of their columns', () => {
    const f = field('multiSelect')
    const rows = [
      row('a', { multiSelect: ['o2'] }, 'a0'),
      row('b', { multiSelect: ['o1', 'o2'] }, 'a1'),
      row('c', {}, 'a2'),
    ]
    expect(groupRows(rows, f, S)).toEqual([
      { key: NO_VALUE, rowIds: ['c'] },
      { key: 'o1', rowIds: ['b'] },
      { key: 'o2', rowIds: ['a', 'b'] },
      { key: 'o3', rowIds: [] },
    ])
    const sorted = runQuery({
      fields: [f, field('text')],
      rows,
      view: { filter: null, sorts: [{ id: 's', fieldId: 'text', dir: 'asc' }], group: { ...S, fieldId: f.id } },
      now: 0,
    })
    expect(sorted.groups?.find((g) => g.key === 'o2')?.rowIds).toEqual(['a', 'b'])
    // filter applies before grouping
    const filtered = runQuery({
      fields: [f],
      rows,
      view: {
        filter: { op: 'and', items: [{ id: 'x', fieldId: f.id, cond: 'hasAny', value: ['o1'] }] },
        sorts: [],
        group: { ...S, fieldId: f.id },
      },
      now: 0,
    })
    expect(filtered.groups?.map((g) => g.rowIds)).toEqual([[], ['b'], ['b'], []])
    expect(runQuery({ fields: [f], rows, view: { filter: null, sorts: [] }, now: 0 }).groups).toBeUndefined()
  })
})

describe('card values for columns (DB-K03, DB-K04)', () => {
  it('new card in a column', async () => {
    const { groupCellValue } = await import('./group')
    expect(groupCellValue(field('select'), 'o1')).toBe('o1')
    expect(groupCellValue(field('multiSelect'), 'o1')).toEqual(['o1'])
    expect(groupCellValue(field('checkbox'), 'true')).toBe(true)
    expect(groupCellValue(field('checkbox'), 'false')).toBe(false)
    expect(groupCellValue(field('date'), 'd:2026-11-27')).toEqual({
      start: new Date(2026, 10, 27).getTime(),
      includeTime: false,
    })
    expect(groupCellValue(field('url'), 'https://x')).toBe('https://x')
    expect(groupCellValue(field('select'), NO_VALUE)).toBeUndefined()
  })
  it('moving a card changes only what the columns mean', async () => {
    const { movedCellValue } = await import('./group')
    expect(movedCellValue(field('select'), 'o1', 'o1', 'o2')).toBe('o2')
    expect(movedCellValue(field('select'), 'o1', 'o1', NO_VALUE)).toBeNull()
    expect(movedCellValue(field('multiSelect'), ['o1', 'o3'], 'o1', 'o2')).toEqual(['o3', 'o2'])
    expect(movedCellValue(field('multiSelect'), ['o1', 'o2'], 'o1', 'o2')).toEqual(['o2'])
    expect(movedCellValue(field('multiSelect'), ['o1'], 'o1', NO_VALUE)).toEqual([])
    expect(movedCellValue(field('checkbox'), false, 'false', 'true')).toBe(true)
    const start = local(2026, 11, 3, 9)
    const v = movedCellValue(
      field('date'),
      { start, end: start + 3600_000, includeTime: true },
      'd:2026-11-03',
      'd:2026-11-20',
    )
    expect(v).toEqual({ start: local(2026, 11, 20, 9), end: local(2026, 11, 20, 10), includeTime: true })
    expect(movedCellValue(field('date'), undefined, NO_VALUE, 'm:2026-12')).toEqual({
      start: new Date(2026, 11, 1).getTime(),
      includeTime: false,
    })
    expect(movedCellValue(field('url'), 'a', 'a', 'b')).toBe('b')
    expect(movedCellValue(field('url'), 'a', 'a', 'a')).toBe('a')
  })
})
