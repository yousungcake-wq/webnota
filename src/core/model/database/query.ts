import { bySiblingOrder } from '../views'
import {
  asChecklist,
  asMedia,
  asNumber,
  asStrings,
  asText,
  cellOf,
  cellText,
  choicesOf,
  isEmptyCell,
  numericOf,
  selectedIds,
  timeOf,
} from './cells'
import type { CalcType, FieldMeta, Filter, FilterCond, FilterGroup, RowSnapshot, Sort, ViewSettings } from './types'

/**
 * Query engine (spec/05 §2): filter → sort → calculations, a pure function shared by every
 * view. `compileQuery` builds the row predicate and comparator once per settings change;
 * the incremental updater (M4-04) reuses them for single rows.
 */

export interface QueryInput {
  fields: FieldMeta[]
  rows: RowSnapshot[]
  view: Pick<ViewSettings, 'filter' | 'sorts'> & Partial<Pick<ViewSettings, 'calcs'>>
  /** "Now" for relative dates (today, this week …). */
  now: number
  /** Current user (person filters, M9). */
  me?: string
  /** Row text search (DB-G07): case-insensitive, over `searchFields` (default: all fields). */
  search?: string
  searchFields?: string[]
  /** First day of the week for "this week": 0 = Sunday, 1 = Monday. */
  weekStart?: 0 | 1
}

export interface CalcResult {
  calc: CalcType
  /** Counts, sums …; percentages are 0–100. null when there is nothing to compute (no numbers). */
  value: number | null
}

export interface QueryResult {
  rowIds: string[]
  calcs: Record<string, CalcResult>
}

export interface CompiledQuery {
  matches(row: RowSnapshot): boolean
  /** Total order: sorts, then manual order (order, id) — stable and deterministic. */
  compare(a: RowSnapshot, b: RowSnapshot): number
}

type Ctx = Pick<QueryInput, 'now' | 'weekStart'>

const collator = new Intl.Collator('ko', { numeric: true })

const startOfDay = (ts: number) => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
/** Start of the next local day (DST-safe). */
const nextDay = (dayStart: number) => {
  const d = new Date(dayStart)
  d.setDate(d.getDate() + 1)
  return d.getTime()
}
const addDays = (dayStart: number, n: number) => {
  const d = new Date(dayStart)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

/** A filter value given as a timestamp or `YYYY-MM-DD` (local day). */
function dayValue(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return startOfDay(v)
  if (typeof v === 'string') {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v)
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
  }
  return null
}

/** Conditions that need no value (the others are inactive while their value is empty). */
const NO_VALUE: ReadonlySet<FilterCond> = new Set([
  'isEmpty',
  'isNotEmpty',
  'checked',
  'unchecked',
  'allDone',
  'notAllDone',
  'today',
  'thisWeek',
  'thisMonth',
  'last7Days',
])

const hasValue = (v: unknown) => !(v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0))

/** Does `row` pass one filter condition? Unknown fields/conditions pass (spec/05 §4.2). */
function testFilter(f: Filter, field: FieldMeta | undefined, row: RowSnapshot, ctx: Ctx): boolean {
  if (!field) return true
  const v = cellOf(field, row)
  if (f.cond === 'isEmpty') return isEmptyCell(field, v)
  if (f.cond === 'isNotEmpty') return !isEmptyCell(field, v)
  if (!NO_VALUE.has(f.cond) && !hasValue(f.value)) return true
  switch (field.type) {
    case 'text':
    case 'url': {
      const cell = asText(v).toLocaleLowerCase()
      const q = String(f.value).toLocaleLowerCase()
      switch (f.cond) {
        case 'contains':
          return cell.includes(q)
        case 'notContains':
          return !cell.includes(q)
        case 'is':
          return cell === q
        case 'isNot':
          return cell !== q
        case 'startsWith':
          return cell.startsWith(q)
        case 'endsWith':
          return cell.endsWith(q)
      }
      return true
    }
    case 'number':
    case 'time': {
      const n = asNumber(v)
      const q = typeof f.value === 'number' ? f.value : Number(f.value)
      if (!Number.isFinite(q)) return true
      if (n === null) return f.cond === 'neq'
      switch (f.cond) {
        case 'eq':
          return n === q
        case 'neq':
          return n !== q
        case 'gt':
          return n > q
        case 'gte':
          return n >= q
        case 'lt':
          return n < q
        case 'lte':
          return n <= q
      }
      return true
    }
    case 'select':
    case 'multiSelect':
    case 'relation':
    case 'person': {
      const ids = field.type === 'select' || field.type === 'multiSelect' ? selectedIds(field, v) : asStrings(v)
      const q = Array.isArray(f.value) ? asStrings(f.value) : [String(f.value)]
      if (q.length === 0) return true
      switch (f.cond) {
        case 'isAnyOf':
        case 'hasAny':
          return ids.some((id) => q.includes(id))
        case 'isNoneOf':
        case 'hasNone':
          return !ids.some((id) => q.includes(id))
        case 'hasAll':
          return q.every((id) => ids.includes(id))
      }
      return true
    }
    case 'date':
    case 'createdTime':
    case 'updatedTime':
      return testDate(f, timeOf(field, v), ctx)
    case 'checkbox':
      if (f.cond === 'checked') return v === true
      if (f.cond === 'unchecked') return v !== true
      return true
    case 'checklist': {
      const items = asChecklist(v)
      const all = items.length > 0 && items.every((i) => i.done)
      if (f.cond === 'allDone') return all
      if (f.cond === 'notAllDone') return !all
      return true
    }
  }
  return true
}

function testDate(f: Filter, ts: number | null, ctx: Ctx): boolean {
  if (ts === null) return false
  const today = startOfDay(ctx.now)
  switch (f.cond) {
    case 'today':
      return ts >= today && ts < nextDay(today)
    case 'thisWeek': {
      const dow = new Date(today).getDay()
      const start = addDays(today, -((dow - (ctx.weekStart ?? 0) + 7) % 7))
      return ts >= start && ts < addDays(start, 7)
    }
    case 'thisMonth': {
      const a = new Date(ts)
      const b = new Date(ctx.now)
      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
    }
    case 'last7Days':
      return ts >= addDays(today, -6) && ts < nextDay(today)
  }
  if (f.cond === 'between') {
    const r = (f.value ?? {}) as { start?: unknown; end?: unknown }
    const a = dayValue(r.start)
    const b = dayValue(r.end)
    if (a === null && b === null) return true
    return (a === null || ts >= a) && (b === null || ts < nextDay(b))
  }
  const day = dayValue(f.value)
  if (day === null) return true
  switch (f.cond) {
    case 'before':
      return ts < day
    case 'after':
      return ts >= nextDay(day)
    case 'onDay':
      return ts >= day && ts < nextDay(day)
  }
  return true
}

const isGroup = (x: Filter | FilterGroup): x is FilterGroup => Array.isArray((x as FilterGroup).items)

function testGroup(g: FilterGroup, fields: Map<string, FieldMeta>, row: RowSnapshot, ctx: Ctx): boolean {
  if (!g.items.length) return true
  const test = (x: Filter | FilterGroup) =>
    isGroup(x) ? testGroup(x, fields, row, ctx) : testFilter(x, fields.get(x.fieldId), row, ctx)
  return g.op === 'or' ? g.items.some(test) : g.items.every(test)
}

/** Sort key compare for one field, ascending; both values non-empty. */
function compareValues(field: FieldMeta, a: unknown, b: unknown): number {
  switch (field.type) {
    case 'number':
    case 'time':
      return asNumber(a)! - asNumber(b)!
    case 'date':
    case 'createdTime':
    case 'updatedTime':
      return timeOf(field, a)! - timeOf(field, b)!
    case 'select':
    case 'multiSelect': {
      // by option order, like AppFlowy (not by name)
      const index = new Map(choicesOf(field).map((c, i) => [c.id, i]))
      const ia = selectedIds(field, a).map((id) => index.get(id)!)
      const ib = selectedIds(field, b).map((id) => index.get(id)!)
      for (let i = 0; i < Math.min(ia.length, ib.length); i++) if (ia[i] !== ib[i]) return ia[i]! - ib[i]!
      return ia.length - ib.length
    }
    case 'checkbox':
      return Number(a === true) - Number(b === true)
    case 'checklist': {
      const p = (v: unknown) => {
        const items = asChecklist(v)
        return items.filter((i) => i.done).length / items.length
      }
      return p(a) - p(b)
    }
    case 'media':
      return asMedia(a).length - asMedia(b).length
    default:
      return collator.compare(cellText(field, a), cellText(field, b))
  }
}

/** Checkbox sorts unchecked first rather than as "empty last". */
const emptyForSort = (field: FieldMeta, v: unknown) => field.type !== 'checkbox' && isEmptyCell(field, v)

export function compileQuery(input: Omit<QueryInput, 'rows'>): CompiledQuery {
  const fields = new Map(input.fields.map((f) => [f.id, f]))
  const filter = input.view.filter
  const sorts = input.view.sorts.filter((s) => fields.has(s.fieldId))
  const q = input.search?.trim().toLocaleLowerCase() ?? ''
  const searchIn = (input.searchFields ?? input.fields.map((f) => f.id))
    .map((id) => fields.get(id))
    .filter((f): f is FieldMeta => !!f)

  const matches = (row: RowSnapshot) => {
    if (filter && !testGroup(filter, fields, row, input)) return false
    if (q && !searchIn.some((f) => cellText(f, cellOf(f, row)).toLocaleLowerCase().includes(q))) return false
    return true
  }
  const compareBy = (s: Sort, a: RowSnapshot, b: RowSnapshot) => {
    const field = fields.get(s.fieldId)!
    const va = cellOf(field, a)
    const vb = cellOf(field, b)
    const ea = emptyForSort(field, va)
    const eb = emptyForSort(field, vb)
    if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1 // empty last in either direction (spec/05 §4.1)
    const c = compareValues(field, va, vb)
    return s.dir === 'desc' ? -c : c
  }
  const compare = (a: RowSnapshot, b: RowSnapshot) => {
    for (const s of sorts) {
      const c = compareBy(s, a, b)
      if (c) return c
    }
    return bySiblingOrder(a, b)
  }
  return { matches, compare }
}

// ---------- calculations (spec/02 §4.4) ----------

const NUMERIC_CALCS: ReadonlySet<CalcType> = new Set(['sum', 'average', 'median', 'min', 'max', 'range'])
const CHECK_CALCS: ReadonlySet<CalcType> = new Set(['countChecked', 'countUnchecked', 'percentChecked'])

/** Calculations a field type offers (the calculation row menu). */
export function calcsFor(field: FieldMeta): CalcType[] {
  const base: CalcType[] = ['count', 'countEmpty', 'countNotEmpty', 'percentEmpty', 'percentNotEmpty']
  if (field.type === 'checkbox') return ['count', 'countChecked', 'countUnchecked', 'percentChecked']
  if (field.type === 'number' || field.type === 'time') return [...base, ...NUMERIC_CALCS]
  if (field.type === 'date' || field.type === 'createdTime' || field.type === 'updatedTime')
    return [...base, 'min', 'max', 'range']
  return base
}

export function calculate(calc: CalcType, field: FieldMeta, rows: RowSnapshot[]): CalcResult {
  const values = rows.map((r) => cellOf(field, r))
  const n = values.length
  const pct = (k: number) => (n ? (k / n) * 100 : null)
  const empty = () => values.filter((v) => isEmptyCell(field, v)).length
  const result = (value: number | null): CalcResult => ({ calc, value })
  switch (calc) {
    case 'count':
      return result(n)
    case 'countEmpty':
      return result(empty())
    case 'countNotEmpty':
      return result(n - empty())
    case 'percentEmpty':
      return result(pct(empty()))
    case 'percentNotEmpty':
      return result(pct(n - empty()))
  }
  if (CHECK_CALCS.has(calc)) {
    const checked = values.filter((v) => v === true).length
    if (calc === 'countChecked') return result(checked)
    if (calc === 'countUnchecked') return result(n - checked)
    return result(pct(checked))
  }
  if (!NUMERIC_CALCS.has(calc)) return result(null)
  const nums = values.map((v) => numericOf(field, v)).filter((x): x is number => x !== null)
  if (!nums.length) return result(calc === 'sum' ? 0 : null)
  switch (calc) {
    case 'sum':
      return result(nums.reduce((s, x) => s + x, 0))
    case 'average':
      return result(nums.reduce((s, x) => s + x, 0) / nums.length)
    case 'median': {
      const s = [...nums].sort((a, b) => a - b)
      const m = s.length >> 1
      return result(s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2)
    }
    case 'min':
      return result(Math.min(...nums))
    case 'max':
      return result(Math.max(...nums))
    case 'range':
      return result(Math.max(...nums) - Math.min(...nums))
  }
  return result(null)
}

export function runQuery(input: QueryInput): QueryResult {
  const q = compileQuery(input)
  const visible = input.rows.filter(q.matches).sort(q.compare)
  const calcs: Record<string, CalcResult> = {}
  const fields = new Map(input.fields.map((f) => [f.id, f]))
  for (const [fieldId, calc] of Object.entries(input.view.calcs ?? {})) {
    const field = fields.get(fieldId)
    if (field) calcs[fieldId] = calculate(calc, field, visible)
  }
  return { rowIds: visible.map((r) => r.id), calcs }
}
