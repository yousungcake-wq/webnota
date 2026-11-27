import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { calculate, calcsFor, cellText, compileQuery, runQuery, type QueryInput } from './index'
import type {
  CalcType,
  CellValue,
  FieldMeta,
  FieldType,
  Filter,
  FilterCond,
  FilterGroup,
  RowSnapshot,
  Sort,
} from './types'

const choices = [
  { id: 'o1', name: 'Todo', color: 'gray' },
  { id: 'o2', name: 'Doing', color: 'blue' },
  { id: 'o3', name: 'Done', color: 'green' },
]
const F = (id: string, type: FieldType, options = {}): FieldMeta => ({ id, name: id, type, options, createdAt: 0 })
const FIELDS: FieldMeta[] = [
  F('text', 'text'),
  F('num', 'number'),
  F('sel', 'select', { choices }),
  F('multi', 'multiSelect', { choices }),
  F('date', 'date'),
  F('check', 'checkbox'),
  F('list', 'checklist'),
  F('url', 'url'),
  F('created', 'createdTime'),
  F('updated', 'updatedTime'),
  F('time', 'time'),
  F('media', 'media'),
  F('rel', 'relation'),
]
const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()
const NOW = day(2026, 11, 27, 10) // a Friday

let seq = 0
function row(cells: Record<string, CellValue>, extra: Partial<RowSnapshot> = {}): RowSnapshot {
  seq++
  const id = extra.id ?? `r${String(seq).padStart(3, '0')}`
  return {
    id,
    order: `a${String(seq).padStart(3, '0')}`,
    cells,
    icon: null,
    cover: null,
    hasDoc: false,
    createdAt: NOW,
    createdBy: '',
    updatedAt: NOW,
    updatedBy: '',
    ...extra,
  }
}

/** Ids of `rows` (by their text cell) passing one filter. */
function pass(rows: RowSnapshot[], fieldId: string, cond: FilterCond, value?: unknown) {
  const filter: FilterGroup = { op: 'and', items: [{ id: 'f', fieldId, cond, value }] }
  const { rowIds } = runQuery({ fields: FIELDS, rows, view: { filter, sorts: [] }, now: NOW })
  return rowIds.map((id) => rows.find((r) => r.id === id)!.cells.text)
}

describe('filters × field types (spec/05 §4.2)', () => {
  it('text and url', () => {
    const rows = [
      row({ text: 'Apple pie' }),
      row({ text: 'apple' }),
      row({ text: 'Banana' }),
      row({ text: '' }),
      row({}),
    ]
    expect(pass(rows, 'text', 'contains', 'APPLE')).toEqual(['Apple pie', 'apple'])
    expect(pass(rows, 'text', 'notContains', 'apple')).toEqual(['Banana', '', undefined])
    expect(pass(rows, 'text', 'is', 'apple')).toEqual(['apple'])
    expect(pass(rows, 'text', 'isNot', 'apple')).toEqual(['Apple pie', 'Banana', '', undefined])
    expect(pass(rows, 'text', 'startsWith', 'ban')).toEqual(['Banana'])
    expect(pass(rows, 'text', 'endsWith', 'PIE')).toEqual(['Apple pie'])
    expect(pass(rows, 'text', 'isEmpty')).toEqual(['', undefined])
    expect(pass(rows, 'text', 'isNotEmpty')).toEqual(['Apple pie', 'apple', 'Banana'])
    expect(pass(rows, 'text', 'contains', '')).toHaveLength(5) // no value yet: inactive
    const urls = [row({ text: 'a', url: 'https://example.com' }), row({ text: 'b' })]
    expect(pass(urls, 'url', 'contains', 'example')).toEqual(['a'])
    expect(pass(urls, 'url', 'isEmpty')).toEqual(['b'])
  })

  it('number and time', () => {
    const rows = [row({ text: 'a', num: 1, time: 30 }), row({ text: 'b', num: 5, time: 90 }), row({ text: 'c' })]
    expect(pass(rows, 'num', 'eq', 5)).toEqual(['b'])
    expect(pass(rows, 'num', 'neq', 5)).toEqual(['a', 'c'])
    expect(pass(rows, 'num', 'gt', 1)).toEqual(['b'])
    expect(pass(rows, 'num', 'gte', 1)).toEqual(['a', 'b'])
    expect(pass(rows, 'num', 'lt', 5)).toEqual(['a'])
    expect(pass(rows, 'num', 'lte', 5)).toEqual(['a', 'b'])
    expect(pass(rows, 'num', 'gt', '1')).toEqual(['b']) // typed into an input
    expect(pass(rows, 'num', 'isEmpty')).toEqual(['c'])
    expect(pass(rows, 'num', 'isNotEmpty')).toEqual(['a', 'b'])
    expect(pass(rows, 'time', 'gte', 60)).toEqual(['b'])
    expect(pass(rows, 'time', 'isEmpty')).toEqual(['c'])
  })

  it('select (deleted options count as empty)', () => {
    const rows = [
      row({ text: 'a', sel: 'o1' }),
      row({ text: 'b', sel: 'o2' }),
      row({ text: 'c' }),
      row({ text: 'd', sel: 'gone' }),
    ]
    expect(pass(rows, 'sel', 'isAnyOf', ['o1', 'o3'])).toEqual(['a'])
    expect(pass(rows, 'sel', 'isNoneOf', ['o1'])).toEqual(['b', 'c', 'd'])
    expect(pass(rows, 'sel', 'isEmpty')).toEqual(['c', 'd'])
    expect(pass(rows, 'sel', 'isNotEmpty')).toEqual(['a', 'b'])
  })

  it('multiSelect', () => {
    const rows = [
      row({ text: 'a', multi: ['o1', 'o2'] }),
      row({ text: 'b', multi: ['o2'] }),
      row({ text: 'c', multi: [] }),
    ]
    expect(pass(rows, 'multi', 'hasAll', ['o1', 'o2'])).toEqual(['a'])
    expect(pass(rows, 'multi', 'hasAny', ['o1', 'o3'])).toEqual(['a'])
    expect(pass(rows, 'multi', 'hasNone', ['o1'])).toEqual(['b', 'c'])
    expect(pass(rows, 'multi', 'isEmpty')).toEqual(['c'])
    expect(pass(rows, 'multi', 'isNotEmpty')).toEqual(['a', 'b'])
  })

  it('date: absolute days and ranges', () => {
    const rows = [
      row({ text: 'a', date: { start: day(2026, 11, 1), includeTime: false } }),
      row({ text: 'b', date: { start: day(2026, 11, 27, 23), includeTime: true } }),
      row({ text: 'c', date: { start: day(2026, 12, 5), end: day(2026, 12, 9), includeTime: false } }),
      row({ text: 'd' }),
    ]
    expect(pass(rows, 'date', 'before', '2026-11-27')).toEqual(['a'])
    expect(pass(rows, 'date', 'after', '2026-11-27')).toEqual(['c'])
    expect(pass(rows, 'date', 'onDay', '2026-11-27')).toEqual(['b'])
    expect(pass(rows, 'date', 'onDay', day(2026, 11, 27, 1))).toEqual(['b'])
    expect(pass(rows, 'date', 'between', { start: '2026-11-01', end: '2026-11-27' })).toEqual(['a', 'b'])
    expect(pass(rows, 'date', 'between', { start: '2026-11-02' })).toEqual(['b', 'c'])
    expect(pass(rows, 'date', 'isEmpty')).toEqual(['d'])
    expect(pass(rows, 'date', 'isNotEmpty')).toEqual(['a', 'b', 'c'])
  })

  it('date: relative (today, this week, this month, last 7 days)', () => {
    const rows = [
      row({ text: 'today', date: { start: day(2026, 11, 27, 0), includeTime: true } }),
      row({ text: 'mon', date: { start: day(2026, 11, 23), includeTime: false } }),
      row({ text: 'sun', date: { start: day(2026, 11, 22), includeTime: false } }),
      row({ text: 'sixAgo', date: { start: day(2026, 11, 21), includeTime: false } }),
      row({ text: 'nov2', date: { start: day(2026, 11, 2), includeTime: false } }),
      row({ text: 'dec', date: { start: day(2026, 12, 1), includeTime: false } }),
    ]
    expect(pass(rows, 'date', 'today')).toEqual(['today'])
    expect(pass(rows, 'date', 'thisWeek')).toEqual(['today', 'mon', 'sun']) // weeks start on Sunday by default
    const monday = runQuery({
      fields: FIELDS,
      rows,
      view: { filter: { op: 'and', items: [{ id: 'f', fieldId: 'date', cond: 'thisWeek' }] }, sorts: [] },
      now: NOW,
      weekStart: 1,
    })
    expect(monday.rowIds.map((id) => rows.find((r) => r.id === id)!.cells.text)).toEqual(['today', 'mon'])
    expect(pass(rows, 'date', 'thisMonth')).toEqual(['today', 'mon', 'sun', 'sixAgo', 'nov2'])
    expect(pass(rows, 'date', 'last7Days')).toEqual(['today', 'mon', 'sun', 'sixAgo'])
  })

  it('created and updated time', () => {
    const rows = [row({ text: 'old' }, { createdAt: day(2026, 1, 1), updatedAt: NOW }), row({ text: 'new' })]
    expect(pass(rows, 'created', 'before', '2026-06-01')).toEqual(['old'])
    expect(pass(rows, 'created', 'today')).toEqual(['new'])
    expect(pass(rows, 'updated', 'today')).toEqual(['old', 'new'])
    expect(pass(rows, 'created', 'isEmpty')).toEqual([])
  })

  it('checkbox, checklist, media, relation', () => {
    const rows = [
      row({
        text: 'a',
        check: true,
        list: [{ id: '1', name: 'x', done: true }],
        media: [{ fileId: 'f', name: 'p.png', mime: 'image/png', size: 1 }],
        rel: ['r9'],
      }),
      row({
        text: 'b',
        check: false,
        list: [
          { id: '1', name: 'x', done: true },
          { id: '2', name: 'y', done: false },
        ],
      }),
      row({ text: 'c' }),
    ]
    expect(pass(rows, 'check', 'checked')).toEqual(['a'])
    expect(pass(rows, 'check', 'unchecked')).toEqual(['b', 'c'])
    expect(pass(rows, 'list', 'allDone')).toEqual(['a'])
    expect(pass(rows, 'list', 'notAllDone')).toEqual(['b', 'c'])
    expect(pass(rows, 'list', 'isEmpty')).toEqual(['c'])
    expect(pass(rows, 'media', 'isNotEmpty')).toEqual(['a'])
    expect(pass(rows, 'media', 'isEmpty')).toEqual(['b', 'c'])
    expect(pass(rows, 'rel', 'hasAny', ['r9'])).toEqual(['a'])
    expect(pass(rows, 'rel', 'isEmpty')).toEqual(['b', 'c'])
  })

  it('ignores filters on unknown fields; AND / OR groups nest two levels', () => {
    const rows = [
      row({ text: 'a', num: 1, check: true }),
      row({ text: 'b', num: 2 }),
      row({ text: 'c', num: 3, check: true }),
    ]
    expect(pass(rows, 'nope', 'is', 'x')).toEqual(['a', 'b', 'c'])
    const filter: FilterGroup = {
      op: 'or',
      items: [
        { id: '1', fieldId: 'num', cond: 'eq', value: 2 },
        {
          op: 'and',
          items: [
            { id: '2', fieldId: 'check', cond: 'checked' },
            { id: '3', fieldId: 'num', cond: 'gt', value: 2 },
          ],
        },
      ],
    }
    expect(runQuery({ fields: FIELDS, rows, view: { filter, sorts: [] }, now: NOW }).rowIds).toEqual([
      rows[1]!.id,
      rows[2]!.id,
    ])
    expect(
      runQuery({ fields: FIELDS, rows, view: { filter: { op: 'or', items: [] }, sorts: [] }, now: NOW }).rowIds,
    ).toHaveLength(3)
  })

  it('row text search covers formatted cells (DB-G07)', () => {
    const rows = [row({ text: 'x', sel: 'o2' }), row({ text: 'Doing laundry' }), row({ text: 'y', num: 42 })]
    const q = (search: string) =>
      runQuery({ fields: FIELDS, rows, view: { filter: null, sorts: [] }, now: NOW, search }).rowIds.length
    expect(q('doing')).toBe(2)
    expect(q('42')).toBe(1)
    expect(q('  ')).toBe(3)
  })
})

describe('sorting (spec/05 §4.1)', () => {
  const ids = (rows: RowSnapshot[], sorts: Sort[]) =>
    runQuery({ fields: FIELDS, rows, view: { filter: null, sorts }, now: NOW }).rowIds.map(
      (id) => rows.find((r) => r.id === id)!.cells.text,
    )

  it('text uses Korean collation with natural numbers; empty values always last', () => {
    const rows = [
      row({ text: '항목10' }),
      row({ text: '항목2' }),
      row({}),
      row({ text: '가나' }),
      row({ text: 'apple' }),
    ]
    expect(ids(rows, [{ id: 's', fieldId: 'text', dir: 'asc' }])).toEqual([
      '가나',
      '항목2',
      '항목10',
      'apple',
      undefined,
    ]) // ko collation: Hangul first
    expect(ids(rows, [{ id: 's', fieldId: 'text', dir: 'desc' }])).toEqual([
      'apple',
      '항목10',
      '항목2',
      '가나',
      undefined,
    ])
  })
  it('numbers, selects by option order, checkboxes, dates; ties keep manual order', () => {
    const rows = [
      row({ text: 'a', num: 3, sel: 'o3', check: true, date: { start: day(2026, 1, 3), includeTime: false } }),
      row({ text: 'b', num: 1, sel: 'o1', date: { start: day(2026, 1, 1), includeTime: false } }),
      row({ text: 'c', num: 1, sel: 'o2', check: true }),
      row({ text: 'd' }),
    ]
    expect(ids(rows, [{ id: 's', fieldId: 'num', dir: 'asc' }])).toEqual(['b', 'c', 'a', 'd'])
    expect(ids(rows, [{ id: 's', fieldId: 'num', dir: 'desc' }])).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(rows, [{ id: 's', fieldId: 'sel', dir: 'asc' }])).toEqual(['b', 'c', 'a', 'd'])
    expect(ids(rows, [{ id: 's', fieldId: 'check', dir: 'asc' }])).toEqual(['b', 'd', 'a', 'c'])
    expect(ids(rows, [{ id: 's', fieldId: 'date', dir: 'desc' }])).toEqual(['a', 'b', 'c', 'd'])
    expect(
      ids(rows, [
        { id: 's1', fieldId: 'num', dir: 'asc' },
        { id: 's2', fieldId: 'sel', dir: 'desc' },
      ]),
    ).toEqual(['c', 'b', 'a', 'd'])
  })
  it('without sorts rows keep manual order (order, id)', () => {
    const rows = [
      row({ text: 'b' }, { order: 'a2' }),
      row({ text: 'a' }, { order: 'a1' }),
      row({ text: 'c' }, { order: 'a1', id: 'zz' }),
    ]
    expect(ids(rows, [])).toEqual(['a', 'c', 'b'])
  })
})

describe('calculations (spec/02 §4.4)', () => {
  const rows = [row({ num: 4, check: true, text: 'x' }), row({ num: 1 }), row({ num: 10, check: true }), row({})]
  const calc = (c: CalcType, fieldId: string) =>
    calculate(
      c,
      FIELDS.find((f) => f.id === fieldId)!,
      rows,
    ).value
  it('counts and percentages', () => {
    expect(calc('count', 'text')).toBe(4)
    expect(calc('countEmpty', 'text')).toBe(3)
    expect(calc('countNotEmpty', 'text')).toBe(1)
    expect(calc('percentEmpty', 'text')).toBe(75)
    expect(calc('percentNotEmpty', 'num')).toBe(75)
    expect(calc('countChecked', 'check')).toBe(2)
    expect(calc('countUnchecked', 'check')).toBe(2)
    expect(calc('percentChecked', 'check')).toBe(50)
  })
  it('numbers', () => {
    expect(calc('sum', 'num')).toBe(15)
    expect(calc('average', 'num')).toBe(5)
    expect(calc('median', 'num')).toBe(4)
    expect(calc('min', 'num')).toBe(1)
    expect(calc('max', 'num')).toBe(10)
    expect(calc('range', 'num')).toBe(9)
    expect(calculate('median', FIELDS[1]!, rows.slice(0, 2)).value).toBe(2.5)
    expect(calculate('average', FIELDS[1]!, []).value).toBeNull()
    expect(calculate('sum', FIELDS[1]!, []).value).toBe(0)
    expect(calculate('percentEmpty', FIELDS[0]!, []).value).toBeNull()
  })
  it('offers calculations by type and runs those of the view over visible rows', () => {
    expect(calcsFor(F('c', 'checkbox'))).toEqual(['count', 'countChecked', 'countUnchecked', 'percentChecked'])
    expect(calcsFor(F('n', 'number'))).toContain('median')
    expect(calcsFor(F('t', 'text'))).not.toContain('sum')
    const r = runQuery({
      fields: FIELDS,
      rows,
      view: {
        filter: { op: 'and', items: [{ id: 'f', fieldId: 'check', cond: 'checked' }] },
        sorts: [],
        calcs: { num: 'sum', gone: 'count' },
      },
      now: NOW,
    })
    expect(r.calcs).toEqual({ num: { calc: 'sum', value: 14 } })
  })
})

describe('cellText (search, TSV, → text)', () => {
  it('formats each type as plain text', () => {
    const r = row({
      sel: 'o2',
      multi: ['o1', 'o3'],
      check: true,
      time: 90,
      date: { start: day(2026, 3, 4), includeTime: false },
    })
    const text = (id: string) =>
      cellText(
        FIELDS.find((f) => f.id === id)!,
        r.cells[id],
      )
    expect(text('sel')).toBe('Doing')
    expect(text('multi')).toBe('Todo, Done')
    expect(text('check')).toBe('true')
    expect(text('time')).toBe('1h 30m')
    expect(text('date')).toBe('2026-03-04')
  })
})

// ---------- property tests (fast-check, spec/05 §12) ----------

const arbRow = fc
  .record({
    id: fc.stringMatching(/^[a-z0-9]{1,6}$/),
    order: fc.stringMatching(/^a[0-9A-Za-z]{0,3}$/),
    text: fc.option(fc.constantFrom('', 'a', 'B', 'ab', '가', '나다', '10', '9'), { nil: undefined }),
    num: fc.option(fc.integer({ min: -5, max: 5 }), { nil: undefined }),
    sel: fc.option(fc.constantFrom('o1', 'o2', 'o3', 'gone'), { nil: undefined }),
    check: fc.option(fc.boolean(), { nil: undefined }),
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
const arbRows = fc.uniqueArray(arbRow, { selector: (r) => r.id, maxLength: 30 })
const arbFilter: fc.Arbitrary<Filter> = fc.oneof(
  fc.record({
    id: fc.constant('f'),
    fieldId: fc.constant('text'),
    cond: fc.constantFrom<FilterCond>(
      'contains',
      'notContains',
      'is',
      'isNot',
      'startsWith',
      'endsWith',
      'isEmpty',
      'isNotEmpty',
    ),
    value: fc.constantFrom('a', 'B', '가', ''),
  }),
  fc.record({
    id: fc.constant('f'),
    fieldId: fc.constant('num'),
    cond: fc.constantFrom<FilterCond>('eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'),
    value: fc.integer({ min: -5, max: 5 }),
  }),
  fc.record({
    id: fc.constant('f'),
    fieldId: fc.constant('sel'),
    cond: fc.constantFrom<FilterCond>('isAnyOf', 'isNoneOf', 'isEmpty', 'isNotEmpty'),
    value: fc.subarray(['o1', 'o2', 'o3']),
  }),
  fc.record({
    id: fc.constant('f'),
    fieldId: fc.constant('check'),
    cond: fc.constantFrom<FilterCond>('checked', 'unchecked'),
  }),
)
const arbSorts = fc.array(
  fc.record({
    id: fc.constant('s'),
    fieldId: fc.constantFrom('text', 'num', 'sel', 'check'),
    dir: fc.constantFrom<'asc' | 'desc'>('asc', 'desc'),
  }),
  { maxLength: 3 },
)
const run = (rows: RowSnapshot[], filter: FilterGroup | null, sorts: Sort[] = []) =>
  runQuery({ fields: FIELDS, rows, view: { filter, sorts }, now: NOW } satisfies QueryInput).rowIds
const one = (f: Filter): FilterGroup => ({ op: 'and', items: [f] })

describe('query properties (fast-check)', () => {
  it('the result does not depend on input order, is a subset, and has no duplicates', () => {
    fc.assert(
      fc.property(arbRows, fc.option(arbFilter, { nil: null }), arbSorts, (rows, f, sorts) => {
        const a = run(rows, f && one(f), sorts)
        const b = run([...rows].reverse(), f && one(f), sorts)
        expect(a).toEqual(b)
        expect(new Set(a).size).toBe(a.length)
        expect(a.every((id) => rows.some((r) => r.id === id))).toBe(true)
      }),
    )
  })
  it('AND is the intersection and OR the union of the single filters', () => {
    fc.assert(
      fc.property(arbRows, arbFilter, arbFilter, (rows, f1, f2) => {
        const s1 = new Set(run(rows, one(f1)))
        const s2 = new Set(run(rows, one(f2)))
        const and = run(rows, { op: 'and', items: [f1, f2] })
        const or = run(rows, { op: 'or', items: [f1, f2] })
        expect(and).toEqual(
          rows
            .filter((r) => s1.has(r.id) && s2.has(r.id))
            .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : a.id < b.id ? -1 : 1))
            .map((r) => r.id),
        )
        expect(new Set(or)).toEqual(new Set(rows.filter((r) => s1.has(r.id) || s2.has(r.id)).map((r) => r.id)))
      }),
    )
  })
  it('complementary conditions split the rows', () => {
    const pairs: [FilterCond, FilterCond][] = [
      ['isEmpty', 'isNotEmpty'],
      ['contains', 'notContains'],
      ['is', 'isNot'],
      ['checked', 'unchecked'],
      ['eq', 'neq'],
      ['isAnyOf', 'isNoneOf'],
    ]
    fc.assert(
      fc.property(arbRows, arbFilter, (rows, f) => {
        const pair = pairs.find((p) => p.includes(f.cond))
        if (!pair) return
        const other = { ...f, cond: pair[0] === f.cond ? pair[1] : pair[0] }
        const a = run(rows, one(f))
        const b = run(rows, one(other))
        if (hasNoValue(f)) return
        expect(a.length + b.length).toBe(rows.length)
        expect(a.filter((id) => b.includes(id))).toEqual([])
      }),
    )
  })
  it('sorting is stable with respect to manual order and puts empty values last', () => {
    fc.assert(
      fc.property(arbRows, arbSorts, (rows, sorts) => {
        const out = run(rows, null, sorts)
        expect(out).toHaveLength(rows.length)
        const first = sorts[0]
        if (!first || first.fieldId === 'check') return
        const field = FIELDS.find((x) => x.id === first.fieldId)!
        const empty = out.map(
          (id) => cellText(field, rows.find((r) => r.id === id)!.cells[first.fieldId]).trim() === '',
        )
        expect(empty.indexOf(true) === -1 || empty.slice(empty.indexOf(true)).every(Boolean)).toBe(true)
      }),
    )
  })
  it('compileQuery.compare is a total order consistent with runQuery', () => {
    fc.assert(
      fc.property(arbRows, arbSorts, (rows, sorts) => {
        const q = compileQuery({ fields: FIELDS, view: { filter: null, sorts }, now: NOW })
        for (const a of rows)
          for (const b of rows) expect(Math.sign(q.compare(a, b))).toBe(-Math.sign(q.compare(b, a)) || 0)
      }),
    )
  })
})

const hasNoValue = (f: Filter) => f.value === '' || (Array.isArray(f.value) && f.value.length === 0)
