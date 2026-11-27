import { asDate, asText, cellOf, choicesOf, selectedIds } from './cells'
import type { QueryGroup } from './query'
import type { CellValue, FieldMeta, FieldType, GroupSettings, RowSnapshot } from './types'

/**
 * Board grouping (M5-02, spec/05 §5 DB-K01): every row gets the keys of the columns it
 * belongs to. Keys are strings stored in view settings (`group.order`, `group.hidden`):
 * - select / multiSelect: the option id (a multi row is in each of its options' columns)
 * - checkbox: `'true'` / `'false'` (no empty column)
 * - date: the start of its day / week / month / year as `d:YYYY-MM-DD`, `w:…`, `m:YYYY-MM`, `y:YYYY`
 * - url: the trimmed address
 * The empty key `''` is the "no value" column.
 */
export const NO_VALUE = ''
export const GROUPABLE_TYPES: ReadonlySet<FieldType> = new Set(['select', 'multiSelect', 'checkbox', 'date', 'url'])
export type DateUnit = NonNullable<GroupSettings['dateUnit']>

const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** The column key of a date for a unit (local time; weeks start on `weekStart`). */
export function dateGroupKey(ts: number, unit: DateUnit, weekStart: 0 | 1 = 0): string {
  const d = new Date(ts)
  switch (unit) {
    case 'year':
      return `y:${d.getFullYear()}`
    case 'month':
      return `m:${d.getFullYear()}-${pad(d.getMonth() + 1)}`
    case 'week': {
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() - weekStart + 7) % 7))
      return `w:${dayKey(start)}`
    }
    default:
      return `d:${dayKey(d)}`
  }
}

/** The first moment of a date key's period (local), e.g. to fill a moved card's date. */
export function dateOfGroupKey(key: string): number | null {
  const m = /^([dwmy]):(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(key)
  if (!m) return null
  return new Date(Number(m[2]), m[3] ? Number(m[3]) - 1 : 0, m[4] ? Number(m[4]) : 1).getTime()
}

export function groupKeysOf(
  field: FieldMeta,
  row: RowSnapshot,
  s: Pick<GroupSettings, 'dateUnit'>,
  weekStart: 0 | 1 = 0,
): string[] {
  const v = cellOf(field, row)
  switch (field.type) {
    case 'select':
    case 'multiSelect': {
      const ids = selectedIds(field, v)
      return ids.length ? (field.type === 'select' ? ids.slice(0, 1) : ids) : [NO_VALUE]
    }
    case 'checkbox':
      return [v === true ? 'true' : 'false']
    case 'date': {
      const d = asDate(v)
      return [d ? dateGroupKey(d.start, s.dateUnit ?? 'month', weekStart) : NO_VALUE]
    }
    case 'url':
      return [asText(v).trim() || NO_VALUE]
    default:
      return [NO_VALUE]
  }
}

/**
 * Columns in display order: keys with a stored `order` first (by that key), then the rest
 * in the field's natural order — options in option order, unchecked before checked, dates
 * oldest first, addresses alphabetically — with "no value" first, like AppFlowy.
 * Select fields have a column for every option even when it is empty.
 */
export function orderGroupKeys(field: FieldMeta, present: Iterable<string>, s: Pick<GroupSettings, 'order'>): string[] {
  const keys = new Set(present)
  let natural: string[]
  if (field.type === 'select' || field.type === 'multiSelect') {
    const options = choicesOf(field).map((c) => c.id)
    natural = [NO_VALUE, ...options]
  } else if (field.type === 'checkbox') natural = ['false', 'true']
  else natural = [...keys].sort((a, b) => (a === NO_VALUE ? -1 : b === NO_VALUE ? 1 : a < b ? -1 : a > b ? 1 : 0))
  for (const k of natural) keys.add(k)
  const rank = new Map(natural.map((k, i) => [k, i]))
  const order = s.order ?? {}
  return [...keys].sort((a, b) => {
    const oa = order[a]
    const ob = order[b]
    if (oa !== undefined && ob !== undefined)
      return oa < ob ? -1 : oa > ob ? 1 : (rank.get(a) ?? 0) - (rank.get(b) ?? 0)
    if (oa !== undefined) return -1
    if (ob !== undefined) return 1
    return (rank.get(a) ?? 0) - (rank.get(b) ?? 0)
  })
}

/**
 * Splits the visible rows (already filtered and sorted) into columns; each column keeps
 * the query order ("sort inside columns", DB-K08). Hidden columns are included — the UI
 * shows them in the hidden-groups panel.
 */
export function groupRows(
  visible: readonly RowSnapshot[],
  field: FieldMeta,
  s: Pick<GroupSettings, 'order' | 'dateUnit'>,
  weekStart: 0 | 1 = 0,
): QueryGroup[] {
  const byKey = new Map<string, string[]>()
  for (const row of visible)
    for (const k of groupKeysOf(field, row, s, weekStart)) {
      const list = byKey.get(k)
      if (list) list.push(row.id)
      else byKey.set(k, [row.id])
    }
  return orderGroupKeys(field, byKey.keys(), s).map((key) => ({ key, rowIds: byKey.get(key) ?? [] }))
}

/** The group field of a view if it can group (it may have been deleted or changed type). */
export function groupFieldOf(fields: FieldMeta[], s: GroupSettings | null | undefined): FieldMeta | null {
  if (!s) return null
  const f = fields.find((x) => x.id === s.fieldId)
  return f && GROUPABLE_TYPES.has(f.type) ? f : null
}

/** The field a new board groups by: the first select, else multi-select, else checkbox. */
export function defaultGroupField(fields: FieldMeta[]): FieldMeta | null {
  for (const t of ['select', 'multiSelect', 'checkbox'] as const) {
    const f = fields.find((x) => x.type === t)
    if (f) return f
  }
  return null
}

/** The cell value that puts a new card in column `key` (DB-K04 "add card to column"). */
export function groupCellValue(field: FieldMeta, key: string): CellValue | undefined {
  if (key === NO_VALUE) return undefined
  switch (field.type) {
    case 'select':
      return key
    case 'multiSelect':
      return [key]
    case 'checkbox':
      return key === 'true'
    case 'date': {
      const start = dateOfGroupKey(key)
      return start === null ? undefined : { start, includeTime: false }
    }
    case 'url':
      return key
    default:
      return undefined
  }
}

/**
 * The new cell value of a card dragged from column `from` to column `to` (DB-K03). A
 * multi-select card only swaps the dragged column's option (its other options stay); a
 * date keeps its time of day and its range length.
 */
export function movedCellValue(
  field: FieldMeta,
  current: CellValue | undefined,
  from: string,
  to: string,
): CellValue | undefined {
  if (from === to) return current
  if (field.type === 'multiSelect') {
    const ids = selectedIds(field, current).filter((id) => id !== from)
    return to === NO_VALUE ? ids : ids.includes(to) ? ids : [...ids, to]
  }
  if (field.type === 'date' && to !== NO_VALUE) {
    const old = asDate(current)
    const start = dateOfGroupKey(to)
    if (!old || start === null) return groupCellValue(field, to)
    const o = new Date(old.start)
    const day = new Date(start)
    const moved = new Date(day.getFullYear(), day.getMonth(), day.getDate(), o.getHours(), o.getMinutes()).getTime()
    return { ...old, start: moved, ...(old.end !== undefined ? { end: moved + (old.end - old.start) } : {}) }
  }
  return field.type === 'checkbox' ? to === 'true' : (groupCellValue(field, to) ?? null)
}
