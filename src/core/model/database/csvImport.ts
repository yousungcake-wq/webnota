import { choicesOf } from './cells'
import { convertValue } from './convert'
import { addField, addRows, getField, readDbMeta, setFieldOptions, type DbDocs } from './model'
import { inferColumn, parseLooseDate, type InferredColumn } from './snapshot'
import type { CellValue, FieldMeta, FieldType, SelectChoice } from './types'

/**
 * CSV import (M6-06, DB-IO, IO-03): columns are typed by inference (`inferColumn`) or by the
 * user's choice in the preview, then written as new rows — into a new database, or appended
 * to an existing one where columns map to fields by name.
 */
const TEXT: FieldMeta = { id: '', name: '', type: 'text', options: {}, createdAt: 0 }

/** Types a CSV column can become. */
export const CSV_TYPES: FieldType[] = ['text', 'number', 'select', 'multiSelect', 'date', 'checkbox', 'url']

/**
 * A column's values as `type`. Select options come from `choices` (an existing field's)
 * plus new ones in first-seen order; dates also accept Notion's "November 27, 2026".
 */
export function columnAs(raw: string[], type: FieldType, choices: SelectChoice[] = []): InferredColumn {
  if (type === 'text') return { type, options: {}, values: raw.map((v) => v.trim() || undefined) }
  const list = [...choices]
  const values = raw.map((v): CellValue | undefined => {
    const s = v.trim()
    if (!s) return undefined
    if (type === 'date') {
      const t = parseLooseDate(s)
      if (t !== null) return { start: t, includeTime: /\d:\d\d/.test(s) }
    }
    if (type === 'multiSelect') return convertValue(TEXT, type, s.replace(/\s*,\s*/g, ','), list)
    return convertValue(TEXT, type, s, list)
  })
  return { type, options: type === 'select' || type === 'multiSelect' ? { choices: list } : {}, values }
}

export interface CsvColumnPlan {
  /** Column index in the CSV. */
  index: number
  name: string
  type: FieldType
  /** 'primary' = the title field; an existing field's id (append); undefined = a new field. */
  fieldId?: string
}

/** Default plan: column 0 is the title, the others new fields of their inferred type. */
export function planCsv(header: string[], records: string[][]): CsvColumnPlan[] {
  return header.map((name, index) => ({
    index,
    name: name.trim() || `Column ${index + 1}`,
    type: index === 0 ? 'text' : inferColumn(records.map((r) => r[index] ?? '')).type,
    ...(index === 0 ? { fieldId: 'primary' } : {}),
  }))
}

/** Writes CSV records as new rows by `plan` (skipped columns are left out). Returns the row count. */
export function importCsv(db: DbDocs, records: string[][], plan: CsvColumnPlan[]): number {
  const primary = readDbMeta(db).primaryFieldId
  const targets = plan.map((p) => {
    const raw = records.map((r) => r[p.index] ?? '')
    if (p.fieldId === 'primary') return { id: primary, col: columnAs(raw, 'text') }
    const existing = p.fieldId ? getField(db, p.fieldId) : null
    if (existing) {
      const col = columnAs(raw, existing.type, choicesOf(existing))
      if (col.options.choices && col.options.choices.length !== choicesOf(existing).length)
        setFieldOptions(db, existing.id, { choices: col.options.choices })
      return { id: existing.id, col }
    }
    const col = columnAs(raw, p.type)
    return { id: addField(db, { name: p.name, type: p.type, options: col.options }), col }
  })
  const rows = records.map((_, i) => {
    const cells: Record<string, CellValue> = {}
    for (const t of targets) {
      const v = t.col.values[i]
      if (v !== undefined) cells[t.id] = v
    }
    return cells
  })
  addRows(db, rows)
  return rows.length
}
