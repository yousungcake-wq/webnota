import { describe, expect, it } from 'vitest'
import { fixedLayout, measuredLayout, visibleColumns } from './rowLayout'

describe('grid row layout (DB-G08)', () => {
  it('fixed heights', () => {
    const l = fixedLayout(10, 36)
    expect([l.top(3), l.total, l.indexAt(80), l.indexAt(-5), l.indexAt(9999)]).toEqual([108, 360, 2, 0, 9])
  })
  it('measured heights: prefix sums, binary search, minimum height', () => {
    const l = measuredLayout(
      ['a', 'b', 'c'],
      new Map([
        ['b', 100],
        ['c', 10],
      ]),
      36,
    )
    expect([l.top(1), l.top(2), l.total, l.height(1)]).toEqual([36, 136, 172, 100])
    expect([l.indexAt(0), l.indexAt(35), l.indexAt(36), l.indexAt(135), l.indexAt(136), l.indexAt(500)]).toEqual([
      0, 0, 1, 1, 2, 2,
    ])
  })
})

describe('column window (DB-G01)', () => {
  const cols = [0, 1, 2, 3, 4, 5].map((i) => ({ left: i * 100, width: 100, frozen: i === 0 }))
  it('keeps frozen columns out and adds overscan', () => {
    expect(visibleColumns(cols, 0, 250, 0)).toEqual({ from: 1, to: 2 })
    expect(visibleColumns(cols, 200, 250, 0)).toEqual({ from: 3, to: 4 })
    expect(visibleColumns(cols, 200, 250)).toEqual({ from: 2, to: 5 })
  })
})
