import { describe, expect, it } from 'vitest'
import { prefillFromFilter } from './prefill'
import { runQuery } from './query'
import type { FieldMeta, FieldType, FilterGroup, RowSnapshot } from './types'

const F = (id: string, type: FieldType, options = {}): FieldMeta => ({ id, name: id, type, options, createdAt: 0 })
const choices = [
  { id: 'a', name: 'A', color: 'red' },
  { id: 'b', name: 'B', color: 'blue' },
]
const fields = [
  F('t', 'text'),
  F('n', 'number'),
  F('s', 'select', { choices }),
  F('m', 'multiSelect', { choices }),
  F('c', 'checkbox'),
  F('d', 'date'),
]
const NOW = new Date(2026, 10, 27, 15).getTime()
const row = (cells: RowSnapshot['cells']): RowSnapshot => ({
  id: 'x',
  order: 'a0',
  cells,
  icon: null,
  cover: null,
  hasDoc: false,
  createdAt: NOW,
  createdBy: '',
  updatedAt: NOW,
  updatedBy: '',
})

describe('new rows satisfy the filter (spec/05 §4.2)', () => {
  it('fills pinned values so the new row stays visible', () => {
    const filter: FilterGroup = {
      op: 'and',
      items: [
        { id: '1', fieldId: 't', cond: 'contains', value: 'abc' },
        { id: '2', fieldId: 'n', cond: 'gt', value: 5 },
        { id: '3', fieldId: 's', cond: 'isAnyOf', value: ['b'] },
        { id: '4', fieldId: 'm', cond: 'hasAll', value: ['a', 'b'] },
        { id: '5', fieldId: 'c', cond: 'checked' },
        { id: '6', fieldId: 'd', cond: 'today' },
      ],
    }
    const cells = prefillFromFilter(filter, fields, NOW)
    expect(cells).toEqual({
      t: 'abc',
      n: 6,
      s: 'b',
      m: ['a', 'b'],
      c: true,
      d: { start: new Date(2026, 10, 27).getTime(), includeTime: false },
    })
    expect(runQuery({ fields, rows: [row(cells)], view: { filter, sorts: [] }, now: NOW }).rowIds).toEqual(['x'])
  })
  it('leaves OR groups and conditions without a pinned value empty', () => {
    const two = [
      { id: '1', fieldId: 't', cond: 'is' as const, value: 'a' },
      { id: '2', fieldId: 'c', cond: 'checked' as const },
    ]
    expect(prefillFromFilter({ op: 'or', items: two }, fields, NOW)).toEqual({})
    // a single condition counts as AND whatever the operator says
    expect(prefillFromFilter({ op: 'or', items: two.slice(0, 1) }, fields, NOW)).toEqual({ t: 'a' })
    expect(
      prefillFromFilter(
        {
          op: 'and',
          items: [
            { id: '1', fieldId: 't', cond: 'notContains', value: 'a' },
            { id: '2', fieldId: 'n', cond: 'isEmpty' },
          ],
        },
        fields,
        NOW,
      ),
    ).toEqual({})
  })
})
