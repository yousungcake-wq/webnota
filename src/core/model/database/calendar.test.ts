import { describe, expect, it } from 'vitest'
import {
  addDaysLocal,
  dayStart,
  defaultDateField,
  eventOf,
  isoWeek,
  layoutWeek,
  monthWeeks,
  shiftDateValue,
  type CalendarEvent,
} from './calendar'
import type { FieldMeta, RowSnapshot } from './types'

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min).getTime()
const row = (cells: RowSnapshot['cells']): RowSnapshot => ({
  id: 'r',
  order: 'a0',
  cells,
  icon: null,
  cover: null,
  hasDoc: false,
  createdAt: d(2026, 11, 5, 15),
  createdBy: '',
  updatedAt: 0,
  updatedBy: '',
})
const date: FieldMeta = { id: 'due', name: 'Due', type: 'date', options: {}, createdAt: 0 }

describe('month grid (M5-06, DB-C01, DB-C06)', () => {
  it('November 2026 starting Sunday: 5 weeks from Nov 1 (a Sunday)', () => {
    const w = monthWeeks(2026, 10, 0)
    expect(w).toHaveLength(5)
    expect(w[0]![0]).toBe(d(2026, 11, 1))
    expect(w.at(-1)![6]).toBe(d(2026, 12, 5))
  })
  it('starting Monday: from Oct 26; February 2026 fits 4 weeks from Sunday, 5 from Monday', () => {
    expect(monthWeeks(2026, 10, 1)[0]![0]).toBe(d(2026, 10, 26))
    expect(monthWeeks(2026, 1, 0)).toHaveLength(4) // Feb 1 2026 is a Sunday, 28 days
    expect(monthWeeks(2026, 1, 1)[0]![0]).toBe(d(2026, 1, 26))
    expect(monthWeeks(2026, 1, 1)).toHaveLength(5)
  })
  it('ISO week numbers, across years', () => {
    expect(isoWeek(d(2026, 1, 1))).toBe(1) // Thursday
    expect(isoWeek(d(2027, 1, 1))).toBe(53) // Friday of 2026-W53
    expect(isoWeek(d(2026, 11, 27))).toBe(48)
    expect(isoWeek(d(2024, 12, 30))).toBe(1)
  })
  it('day helpers are DST-safe', () => {
    expect(addDaysLocal(d(2026, 3, 28, 13), 2)).toBe(d(2026, 3, 30))
    expect(dayStart(d(2026, 3, 28, 23, 59))).toBe(d(2026, 3, 28))
  })
})

describe('events', () => {
  it('reads date fields (range end clamps to the start) and created time', () => {
    expect(eventOf(date, row({ due: { start: d(2026, 11, 3, 9), includeTime: true } }))).toEqual({
      id: 'r',
      start: d(2026, 11, 3),
      end: d(2026, 11, 3),
    })
    expect(
      eventOf(date, row({ due: { start: d(2026, 11, 3), end: d(2026, 11, 6, 10), includeTime: false } }))!.end,
    ).toBe(d(2026, 11, 6))
    expect(eventOf(date, row({ due: { start: d(2026, 11, 3), end: d(2026, 11, 1), includeTime: false } }))!.end).toBe(
      d(2026, 11, 3),
    )
    expect(eventOf(date, row({}))).toBeNull()
    const created: FieldMeta = { ...date, id: 'c', type: 'createdTime' }
    expect(eventOf(created, row({}))!.start).toBe(d(2026, 11, 5))
    expect(defaultDateField([{ ...date, type: 'text' }, date])?.id).toBe('due')
  })

  it('lays out bars in lanes; long and early events first; continuation flags', () => {
    const week = Array.from({ length: 7 }, (_, i) => d(2026, 11, 8 + i)) // Sun 8 … Sat 14
    const ev = (id: string, a: number, b: number): CalendarEvent => ({ id, start: d(2026, 11, a), end: d(2026, 11, b) })
    const bars = layoutWeek([ev('one', 9, 9), ev('long', 6, 10), ev('later', 10, 16), ev('same', 9, 9)], week)
    const by = Object.fromEntries(bars.map((b) => [b.id, b]))
    expect(by.long).toEqual({ id: 'long', col: 0, span: 3, lane: 0, before: true, after: false })
    expect(by.one).toMatchObject({ col: 1, span: 1, lane: 1 })
    expect(by.same).toMatchObject({ col: 1, span: 1, lane: 2 })
    expect(by.later).toMatchObject({ col: 2, span: 5, lane: 1, before: false, after: true })
    // without weekends (Mon–Fri): an event on Sunday only disappears
    const weekdays = week.slice(1, 6)
    expect(layoutWeek([ev('sun', 8, 8), ev('mon', 9, 9)], weekdays).map((b) => [b.id, b.col])).toEqual([['mon', 0]])
  })

  it('shifts dates by days keeping time and length', () => {
    const v = { start: d(2026, 11, 3, 9, 30), end: d(2026, 11, 4, 11), includeTime: true }
    expect(shiftDateValue(v, 10)).toEqual({
      start: d(2026, 11, 13, 9, 30),
      end: d(2026, 11, 14, 11),
      includeTime: true,
    })
    expect(shiftDateValue({ start: d(2026, 3, 27), includeTime: false }, 3).start).toBe(d(2026, 3, 30))
  })
})
