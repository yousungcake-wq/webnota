import { orderedFields, type FieldMeta, type ViewSettings } from '@/core/model/database'

export const ROW_HEIGHT = 36
export const HEADER_HEIGHT = 36
export const TOUCH_ROW_HEIGHT = 44
/** Left gutter with the row's "+" and drag/menu handle (DB-G02). */
export const GUTTER = 44

export interface Column {
  field: FieldMeta
  width: number
  wrap: boolean
  left: number
  frozen: boolean
}

/** The view's visible columns with their offsets (frozen ones first, DB-F06). */
export function columnsOf(fields: FieldMeta[], view: ViewSettings | null, maxFrozenWidth = Infinity): Column[] {
  if (!view) return []
  let left = 0
  return orderedFields(fields, view)
    .filter((f) => view.fields[f.id]?.visible !== false)
    .map((field, i) => {
      const s = view.fields[field.id]
      const frozen = i < view.frozenColumns
      // phones: a frozen column must leave room for the scrolling ones (MB-30)
      const width = frozen ? Math.min(s?.width ?? 180, maxFrozenWidth) : (s?.width ?? 180)
      const col = { field, width, wrap: s?.wrap ?? false, left, frozen }
      left += col.width
      return col
    })
}

/**
 * The columns to render: frozen ones always, then the scrolling window `from..to`, with
 * spacer widths standing in for the columns skipped on either side (DB-G01).
 */
export function renderedColumns(columns: Column[], range: { from: number; to: number }) {
  const frozen = columns.filter((c) => c.frozen)
  const shown = columns.slice(range.from, range.to + 1).filter((c) => !c.frozen)
  const frozenW = frozen.reduce((n, c) => n + c.width, 0)
  const before = shown.length ? shown[0]!.left - frozenW : 0
  const total = columns.reduce((n, c) => n + c.width, 0)
  const last = shown.at(-1)
  const after = last ? total - (last.left + last.width) : total - frozenW
  return { frozen, shown, before, after }
}
