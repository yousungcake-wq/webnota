import {
  addRows,
  cellOf,
  choicesOf,
  copyText,
  getRow,
  parseTSV,
  pasteValue,
  setCell,
  setFieldOptions,
  toTSV,
  type CellValue,
  type DbDocs,
  type FieldMeta,
  type SelectChoice,
} from '@/core/model/database'
import type { GridPos } from './GridRow'

/** A rectangle of cells by row and column index (inclusive). */
export interface CellRect {
  r0: number
  r1: number
  c0: number
  c1: number
}

export function rectOf(
  anchor: GridPos | null,
  focus: GridPos | null,
  rowIds: string[],
  fieldIds: string[],
): CellRect | null {
  if (!focus) return null
  const a = anchor ?? focus
  const ra = rowIds.indexOf(a.rowId)
  const rf = rowIds.indexOf(focus.rowId)
  const ca = fieldIds.indexOf(a.fieldId)
  const cf = fieldIds.indexOf(focus.fieldId)
  if (ra < 0 || rf < 0 || ca < 0 || cf < 0) return null
  return { r0: Math.min(ra, rf), r1: Math.max(ra, rf), c0: Math.min(ca, cf), c1: Math.max(ca, cf) }
}

/** The rectangle as TSV (DB-G04). */
export function copyRect(docs: DbDocs, rect: CellRect, rowIds: string[], fields: FieldMeta[]): string {
  const out: string[][] = []
  for (let r = rect.r0; r <= rect.r1; r++) {
    const row = getRow(docs, rowIds[r]!)
    out.push(fields.slice(rect.c0, rect.c1 + 1).map((f) => (row ? copyText(f, cellOf(f, row)) : '')))
  }
  return toTSV(out)
}

// relations are edited in their picker only: a two-way pair must change on both sides (M6-03)
const SKIP = new Set(['createdTime', 'updatedTime', 'rollup', 'relation'])

/** Clears every editable cell of the rectangle. */
export function clearRect(docs: DbDocs, rect: CellRect, rowIds: string[], fields: FieldMeta[]) {
  for (let r = rect.r0; r <= rect.r1; r++)
    for (const f of fields.slice(rect.c0, rect.c1 + 1)) if (!SKIP.has(f.type)) setCell(docs, rowIds[r]!, f.id, null)
}

/**
 * Pastes TSV at the rectangle's top-left (DB-G04): rows beyond the end are added; one
 * pasted value fills a selected range (spreadsheet behaviour). Values are parsed per type;
 * new select options are created. Returns the pasted rectangle.
 */
export function pasteTSV(
  docs: DbDocs,
  text: string,
  rect: CellRect,
  rowIds: string[],
  fields: FieldMeta[],
  newRowCells: () => Record<string, CellValue>,
): CellRect | null {
  let grid = parseTSV(text)
  if (!grid.length) return null
  if (grid.length === 1 && grid[0]!.length === 1 && (rect.r1 > rect.r0 || rect.c1 > rect.c0)) {
    const v = grid[0]![0]!
    grid = Array.from({ length: rect.r1 - rect.r0 + 1 }, () => Array.from({ length: rect.c1 - rect.c0 + 1 }, () => v))
  }
  const width = Math.min(Math.max(...grid.map((r) => r.length)), fields.length - rect.c0)
  const choices = new Map<string, SelectChoice[]>()
  const choicesFor = (f: FieldMeta) => {
    let c = choices.get(f.id)
    if (!c) choices.set(f.id, (c = [...choicesOf(f)]))
    return c
  }
  const valuesOf = (line: string[]) => {
    const cells: Record<string, CellValue | undefined | false> = {}
    for (let c = 0; c < width; c++) {
      const f = fields[rect.c0 + c]!
      cells[f.id] = pasteValue(f, line[c] ?? '', choicesFor(f))
    }
    return cells
  }
  // parse everything first, so new options exist before cells point at them
  const parsed = grid.map((line, k) => ({ rowId: rowIds[rect.r0 + k], cells: valuesOf(line) }))
  for (const [fieldId, list] of choices) {
    const f = fields.find((x) => x.id === fieldId)!
    if (list.length !== choicesOf(f).length) setFieldOptions(docs, fieldId, { choices: list })
  }
  const added: Record<string, CellValue>[] = []
  for (const { rowId, cells } of parsed) {
    if (!rowId) {
      const fresh: Record<string, CellValue> = { ...newRowCells() }
      for (const [id, v] of Object.entries(cells)) if (v !== false && v !== undefined) fresh[id] = v
      added.push(fresh)
    } else for (const [id, v] of Object.entries(cells)) if (v !== false) setCell(docs, rowId, id, v ?? null)
  }
  if (added.length) addRows(docs, added, { afterId: rowIds.at(-1) })
  return { r0: rect.r0, r1: rect.r0 + grid.length - 1, c0: rect.c0, c1: rect.c0 + width - 1 }
}
