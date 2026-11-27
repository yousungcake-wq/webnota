import { choicesOf } from './cells'
import type { CellValue, FieldMeta, Filter, FilterGroup } from './types'

const dayStart = (ts: number) => new Date(ts).setHours(0, 0, 0, 0)

/**
 * Cell values that make a new row pass the view's filter (spec/05 §4.2: "fill in filter
 * values so the row does not vanish"). Only top-level AND conditions with a value that
 * pins the cell are used; anything else is left empty.
 */
export function prefillFromFilter(
  filter: FilterGroup | null,
  fields: FieldMeta[],
  now: number,
): Record<string, CellValue> {
  const out: Record<string, CellValue> = {}
  if (!filter || filter.op !== 'and') return out
  const byId = new Map(fields.map((f) => [f.id, f]))
  for (const item of filter.items) {
    if ('items' in item) continue
    const f = item as Filter
    const field = byId.get(f.fieldId)
    if (!field || f.fieldId in out) continue
    const v = valueFor(field, f, now)
    if (v !== undefined) out[f.fieldId] = v
  }
  return out
}

function valueFor(field: FieldMeta, f: Filter, now: number): CellValue | undefined {
  const has =
    f.value !== undefined && f.value !== null && f.value !== '' && !(Array.isArray(f.value) && !f.value.length)
  switch (field.type) {
    case 'text':
    case 'url':
      return has && ['is', 'contains', 'startsWith', 'endsWith'].includes(f.cond) ? String(f.value) : undefined
    case 'number':
    case 'time': {
      const n = Number(f.value)
      if (!has || !Number.isFinite(n)) return undefined
      return { eq: n, gte: n, lte: n, gt: n + 1, lt: n - 1 }[f.cond as 'eq']
    }
    case 'select': {
      const ids = Array.isArray(f.value) ? f.value : []
      const known = choicesOf(field).find((c) => ids.includes(c.id))
      return f.cond === 'isAnyOf' && known ? known.id : undefined
    }
    case 'multiSelect': {
      const ids = (Array.isArray(f.value) ? f.value : []).filter((id) => choicesOf(field).some((c) => c.id === id))
      if (!ids.length) return undefined
      return f.cond === 'hasAll' ? ids : f.cond === 'hasAny' ? [ids[0]] : undefined
    }
    case 'checkbox':
      return f.cond === 'checked' ? true : undefined
    case 'date': {
      if (f.cond === 'today' || f.cond === 'thisWeek' || f.cond === 'thisMonth' || f.cond === 'last7Days')
        return { start: dayStart(now), includeTime: false }
      if (f.cond === 'onDay' && has) {
        const m = typeof f.value === 'string' ? /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(f.value) : null
        const ts = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : Number(f.value)
        return Number.isFinite(ts) ? { start: dayStart(ts), includeTime: false } : undefined
      }
      return undefined
    }
  }
  return undefined
}
