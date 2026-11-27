import { asDate, cellOf } from './cells'
import type { CalendarSettings, FieldMeta, RowSnapshot } from './types'

/**
 * Calendar month layout (M5-06, spec/05 §6): pure date math in local time, shared by the
 * desktop month grid and the phone month + list.
 */

const DAY = 86_400_000

/** Local midnight of a timestamp. */
export const dayStart = (ts: number) => {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
/** `days` calendar days later (DST-safe: built from the date, not by adding ms). */
export const addDaysLocal = (ts: number, days: number) => {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime()
}
/** Whole calendar days from a to b (DST-safe). */
export const daysBetween = (a: number, b: number) => Math.round((dayStart(b) - dayStart(a)) / DAY)

/**
 * The weeks shown for a month: from the week containing the 1st to the week containing
 * the last day (4–6 weeks), each 7 local midnights starting on `firstDay`.
 */
export function monthWeeks(year: number, month: number, firstDay: 0 | 1): number[][] {
  const first = new Date(year, month, 1)
  const start = addDaysLocal(first.getTime(), -((first.getDay() - firstDay + 7) % 7))
  const last = new Date(year, month + 1, 0).getTime()
  const weeks: number[][] = []
  for (let w = start; w <= last; w = addDaysLocal(w, 7))
    weeks.push(Array.from({ length: 7 }, (_, i) => addDaysLocal(w, i)))
  return weeks
}

/** ISO 8601 week number of a day (weeks start Monday; week 1 holds the first Thursday). */
export function isoWeek(ts: number): number {
  const d = new Date(ts)
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(thursday.getFullYear(), 0, 4)
  return 1 + Math.round((daysBetween(jan4.getTime(), thursday.getTime()) - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}

export interface CalendarEvent {
  id: string
  /** Local midnight of the first and last day (inclusive). */
  start: number
  end: number
}

/** A row's event for a date field, or null when the row has no date. */
export function eventOf(field: FieldMeta, row: RowSnapshot): CalendarEvent | null {
  const v = cellOf(field, row)
  if (field.type === 'date') {
    const d = asDate(v)
    if (!d) return null
    const start = dayStart(d.start)
    const end = d.end !== undefined ? Math.max(start, dayStart(d.end)) : start
    return { id: row.id, start, end }
  }
  if ((field.type === 'createdTime' || field.type === 'updatedTime') && typeof v === 'number') {
    const s = dayStart(v)
    return { id: row.id, start: s, end: s }
  }
  return null
}

export interface WeekBar {
  id: string
  /** First column (0–6) and number of columns in this week. */
  col: number
  span: number
  lane: number
  /** The event started before / goes on after this week. */
  before: boolean
  after: boolean
}

/**
 * Bars of the events overlapping one week (DB-C03): longer and earlier events take the
 * upper lanes; each event gets the first lane free on all of its days. `days` are the
 * week's shown days (7, or 5 without weekends) — an event on hidden days only is skipped.
 */
export function layoutWeek(events: readonly CalendarEvent[], days: readonly number[]): WeekBar[] {
  if (!days.length) return []
  const first = days[0]!
  const last = days.at(-1)!
  const inWeek = events
    .filter((e) => e.end >= first && e.start <= last)
    .map((e) => {
      const cols = days.map((d, i) => (d >= e.start && d <= e.end ? i : -1)).filter((i) => i >= 0)
      return { e, cols }
    })
    .filter((x) => x.cols.length > 0)
    .sort((a, b) => a.e.start - b.e.start || b.e.end - b.e.start - (a.e.end - a.e.start) || (a.e.id < b.e.id ? -1 : 1))
  const lanes: boolean[][] = []
  return inWeek.map(({ e, cols }) => {
    const col = cols[0]!
    const span = cols.at(-1)! - col + 1
    let lane = 0
    while (lanes[lane]?.slice(col, col + span).some(Boolean)) lane++
    lanes[lane] ??= []
    for (let i = col; i < col + span; i++) lanes[lane]![i] = true
    return { id: e.id, col, span, lane, before: e.start < days[col]!, after: e.end > days[col + span - 1]! }
  })
}

/** The first date field (calendar default, DB-C02). */
export const defaultDateField = (fields: FieldMeta[]) => fields.find((f) => f.type === 'date') ?? null

/** A date value moved by whole days, keeping time of day and range length (DB-C04). */
export function shiftDateValue<T extends { start: number; end?: number }>(v: T, days: number): T {
  const move = (ts: number) => {
    const d = new Date(ts)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes()).getTime()
  }
  return { ...v, start: move(v.start), ...(v.end !== undefined ? { end: move(v.end) } : {}) }
}

export const DEFAULT_CALENDAR: CalendarSettings = {
  dateFieldId: null,
  firstDayOfWeek: 0,
  showWeekends: true,
  showWeekNumbers: false,
}
