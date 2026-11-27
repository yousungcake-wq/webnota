import type { CellValue, ChecklistItem, DateValue, FieldMeta, MediaItem, RowSnapshot, SelectChoice } from './types'

/**
 * Reading cells by field type (spec/02 §4.3). Stored values come from other devices and
 * older versions, so every reader checks the shape and treats anything else as empty.
 */

/** The cell's value; createdTime/updatedTime come from the row itself. */
export function cellOf(field: FieldMeta, row: RowSnapshot): CellValue | undefined {
  if (field.type === 'createdTime') return row.createdAt
  if (field.type === 'updatedTime') return row.updatedAt
  return row.cells[field.id]
}

export const asText = (v: unknown): string => (typeof v === 'string' ? v : '')
export const asNumber = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
export const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
export function asDate(v: unknown): DateValue | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const d = v as DateValue
  return typeof d.start === 'number' && Number.isFinite(d.start) ? d : null
}
export const asChecklist = (v: unknown): ChecklistItem[] =>
  Array.isArray(v)
    ? v.filter((x): x is ChecklistItem => !!x && typeof x === 'object' && typeof x.name === 'string')
    : []
export const asMedia = (v: unknown): MediaItem[] =>
  Array.isArray(v) ? v.filter((x): x is MediaItem => !!x && typeof x === 'object' && typeof x.fileId === 'string') : []

export const choicesOf = (field: FieldMeta): SelectChoice[] =>
  Array.isArray(field.options.choices) ? field.options.choices : []

/** Selected option ids that still exist, in stored order. */
export function selectedIds(field: FieldMeta, v: unknown): string[] {
  const known = new Set(choicesOf(field).map((c) => c.id))
  const ids = field.type === 'select' ? (typeof v === 'string' ? [v] : []) : asStrings(v)
  return ids.filter((id) => known.has(id))
}

/** A comparable timestamp for date-like fields (date start, created/updated time). */
export function timeOf(field: FieldMeta, v: unknown): number | null {
  if (field.type === 'date') return asDate(v)?.start ?? null
  if (field.type === 'createdTime' || field.type === 'updatedTime') return asNumber(v)
  return null
}

/** A number for numeric calculations (sum/min/…): number, time, and date-like fields. */
export function numericOf(field: FieldMeta, v: unknown): number | null {
  if (field.type === 'number' || field.type === 'time') return asNumber(v)
  return timeOf(field, v)
}

export function isEmptyCell(field: FieldMeta, v: unknown): boolean {
  switch (field.type) {
    case 'text':
    case 'url':
      return asText(v).trim() === ''
    case 'number':
    case 'time':
      return asNumber(v) === null
    case 'select':
    case 'multiSelect':
      return selectedIds(field, v).length === 0
    case 'date':
      return asDate(v) === null
    case 'checkbox':
      return v !== true
    case 'checklist':
      return asChecklist(v).length === 0
    case 'media':
      return asMedia(v).length === 0
    case 'relation':
    case 'person':
      return asStrings(v).length === 0
    case 'createdTime':
    case 'updatedTime':
      return asNumber(v) === null
    default:
      return v === undefined || v === null || v === ''
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
/** `YYYY-MM-DD` (local), with ` HH:mm` when `time`. Display formats are in the UI (M4-06). */
export function isoDay(ts: number, time = false): string {
  const d = new Date(ts)
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return time ? `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}` : day
}

/** `1h 30m` for minutes (time field). */
export function formatMinutes(min: number): string {
  const sign = min < 0 ? '-' : ''
  const m = Math.abs(Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  return sign + (h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`)
}

/**
 * Plain text of a cell: row search, TSV copy and "any type → text" conversion (spec/05 §3.4).
 * Numbers are unformatted here; the grid formats them for display (M4-05).
 */
export function cellText(field: FieldMeta, v: unknown): string {
  switch (field.type) {
    case 'text':
    case 'url':
      return asText(v)
    case 'number': {
      const n = asNumber(v)
      return n === null ? '' : String(n)
    }
    case 'time': {
      const n = asNumber(v)
      return n === null ? '' : formatMinutes(n)
    }
    case 'select':
    case 'multiSelect': {
      const byId = new Map(choicesOf(field).map((c) => [c.id, c.name]))
      return selectedIds(field, v)
        .map((id) => byId.get(id)!)
        .join(', ')
    }
    case 'date': {
      const d = asDate(v)
      if (!d) return ''
      const s = isoDay(d.start, d.includeTime)
      return d.end !== undefined ? `${s} → ${isoDay(d.end, d.includeTime)}` : s
    }
    case 'createdTime':
    case 'updatedTime': {
      const n = asNumber(v)
      return n === null ? '' : isoDay(n, true)
    }
    case 'checkbox':
      return v === true ? 'true' : 'false'
    case 'checklist':
      return asChecklist(v)
        .map((i) => i.name)
        .join(', ')
    case 'media':
      return asMedia(v)
        .map((m) => m.name)
        .join(', ')
    default:
      return Array.isArray(v) ? v.join(', ') : typeof v === 'string' || typeof v === 'number' ? String(v) : ''
  }
}
