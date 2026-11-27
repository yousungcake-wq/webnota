import * as Y from 'yjs'
import { assertWritable } from '../guard'
import {
  addRows,
  dbViewsOf,
  fieldsOf,
  listFields,
  listRows,
  readDbMeta,
  readViewSettings,
  rowsOf,
  type DbDocs,
} from './model'
import { shardOf } from './shard'
import type { CellValue, DbMeta, FieldMeta, RowSnapshot, ViewSettings } from './types'
import { parseDate, parseNumber } from './format'
import { newId } from '../views'

/**
 * A database as plain JSON (feedback 11: lossless WebNota export): meta, fields with their
 * ids, every view's settings (keyed by workspace view id) and every row.
 */
export interface DatabaseSnapshot {
  meta: DbMeta
  fields: FieldMeta[]
  views: ViewSettings[]
  rows: RowSnapshot[]
}

export function snapshotDatabase(db: DbDocs): DatabaseSnapshot {
  const views: ViewSettings[] = []
  dbViewsOf(db).forEach((_m, id) => {
    const v = readViewSettings(db, id)
    if (v) views.push(v)
  })
  return { meta: readDbMeta(db), fields: listFields(db), views, rows: listRows(db) }
}

/**
 * Writes a snapshot into empty db docs. Field and row ids are kept (they are local to the
 * database); view settings are re-keyed through `viewIds` (old → new workspace view id).
 */
export function restoreDatabase(db: DbDocs, snap: DatabaseSnapshot, viewIds: Map<string, string>) {
  assertWritable()
  db.schema.transact(() => {
    const meta = db.schema.getMap<unknown>('meta')
    meta.set('schemaVersion', snap.meta.schemaVersion)
    meta.set('shardCount', db.shards.length)
    meta.set('primaryFieldId', snap.meta.primaryFieldId)
    meta.set('createdAt', snap.meta.createdAt)
    for (const f of snap.fields) {
      const m = new Y.Map<unknown>()
      m.set('name', f.name)
      m.set('type', f.type)
      const o = new Y.Map<unknown>()
      for (const [k, v] of Object.entries(f.options)) if (v !== undefined) o.set(k, v)
      m.set('options', o)
      m.set('createdAt', f.createdAt)
      fieldsOf(db).set(f.id, m)
    }
    for (const v of snap.views) {
      const id = viewIds.get(v.id)
      if (!id) continue
      const m = new Y.Map<unknown>()
      m.set('layout', v.layout)
      const fields = new Y.Map<unknown>()
      for (const [fid, s] of Object.entries(v.fields)) {
        const fm = new Y.Map<unknown>()
        fm.set('visible', s.visible)
        fm.set('width', s.width)
        fm.set('order', s.order)
        fm.set('wrap', s.wrap)
        fields.set(fid, fm)
      }
      m.set('fields', fields)
      m.set('filter', v.filter)
      m.set('sorts', v.sorts)
      m.set('group', null)
      const calcs = new Y.Map<unknown>()
      for (const [fid, c] of Object.entries(v.calcs)) calcs.set(fid, c)
      m.set('calcs', calcs)
      m.set('frozenColumns', v.frozenColumns)
      dbViewsOf(db).set(id, m)
    }
  })
  const byShard = new Map<Y.Doc, RowSnapshot[]>()
  for (const r of snap.rows) {
    const s = db.shards[shardOf(r.id, db.shards.length)]!
    byShard.set(s, [...(byShard.get(s) ?? []), r])
  }
  for (const [shard, rows] of byShard)
    shard.transact(() => {
      for (const r of rows) {
        const m = new Y.Map<unknown>()
        m.set('order', r.order)
        const cells = new Y.Map<unknown>()
        for (const [k, v] of Object.entries(r.cells)) cells.set(k, v)
        m.set('cells', cells)
        m.set('icon', r.icon)
        m.set('cover', r.cover)
        m.set('hasDoc', r.hasDoc)
        m.set('createdAt', r.createdAt)
        m.set('createdBy', r.createdBy)
        m.set('updatedAt', r.updatedAt)
        m.set('updatedBy', r.updatedBy)
        rowsOf(shard).set(r.id, m)
      }
    })
}

// ---------- CSV columns (Notion import, IO-03) ----------

const TRUE = new Set(['yes', 'true', '✓', '✔', 'checked', 'y', '1'])
const FALSE = new Set(['no', 'false', '', 'n', '0', 'unchecked'])

/** Dates the way Notion writes them in CSV: "November 27, 2026", "2026/11/27", with an optional time. */
export function parseLooseDate(s: string): number | null {
  const v = s.trim()
  if (!v) return null
  const iso = parseDate(v.replace(/\s+\d{1,2}:\d{2}\s*(AM|PM)?$/i, ''))
  if (iso) return iso.start
  if (/^[A-Za-z]+ \d{1,2}, \d{4}/.test(v)) {
    const t = Date.parse(v.replace(/\(.*\)/, ''))
    return Number.isFinite(t) ? t : null
  }
  return null
}

export interface InferredColumn {
  type: FieldMeta['type']
  options: FieldMeta['options']
  /** Cell values in row order (undefined = empty). */
  values: (CellValue | undefined)[]
}

/**
 * Picks a field type for one CSV column (spec/05 §9): number, checkbox, date, url,
 * select (≤ 20 distinct values, some repeated) / multi-select (comma lists), else text.
 */
export function inferColumn(raw: string[]): InferredColumn {
  const vals = raw.map((v) => v.trim())
  const filled = vals.filter(Boolean)
  const all = (f: (v: string) => boolean) => filled.length > 0 && filled.every(f)
  if (all((v) => parseNumber(v) !== null))
    return { type: 'number', options: {}, values: vals.map((v) => parseNumber(v) ?? undefined) }
  if (filled.length > 0 && vals.every((v) => TRUE.has(v.toLowerCase()) || FALSE.has(v.toLowerCase())))
    return { type: 'checkbox', options: {}, values: vals.map((v) => (TRUE.has(v.toLowerCase()) ? true : undefined)) }
  if (all((v) => parseLooseDate(v) !== null))
    return {
      type: 'date',
      options: {},
      values: vals.map((v) => {
        const t = parseLooseDate(v)
        return t === null ? undefined : { start: t, includeTime: /\d:\d\d/.test(v) }
      }),
    }
  if (all((v) => /^https?:\/\/\S+$/i.test(v)))
    return { type: 'url', options: {}, values: vals.map((v) => v || undefined) }
  const multi = filled.some((v) => v.includes(', '))
  const names = [...new Set(filled.flatMap((v) => (multi ? v.split(/\s*,\s*/) : [v])).filter(Boolean))]
  const repeated = names.length < filled.length
  if (names.length > 0 && names.length <= 20 && (repeated || multi) && names.every((n) => n.length <= 60)) {
    const colors = ['purple', 'pink', 'light-pink', 'orange', 'yellow', 'lime', 'green', 'aqua', 'blue', 'gray']
    const choices = names.map((name, i) => ({ id: newId(), name, color: colors[i % colors.length]! }))
    const idOf = new Map(choices.map((c) => [c.name, c.id]))
    return {
      type: multi ? 'multiSelect' : 'select',
      options: { choices },
      values: vals.map((v) => {
        if (!v) return undefined
        if (!multi) return idOf.get(v)
        return v
          .split(/\s*,\s*/)
          .map((n) => idOf.get(n))
          .filter((x): x is string => !!x)
      }),
    }
  }
  return { type: 'text', options: {}, values: vals.map((v) => v || undefined) }
}

/** Adds CSV rows (header + records) to a database whose primary field takes column 0. */
export function importCsvRows(
  db: DbDocs,
  header: string[],
  records: string[][],
  addField: (name: string, col: InferredColumn) => string,
): number {
  const primary = readDbMeta(db).primaryFieldId
  const columns = header.map((_, c) => inferColumn(records.map((r) => r[c] ?? '')))
  const ids = header.map((name, c) => (c === 0 ? primary : addField(name || `Column ${c + 1}`, columns[c]!)))
  const rows = records.map((r, i) => {
    const cells: Record<string, CellValue> = {}
    ids.forEach((id, c) => {
      const v = c === 0 ? r[0]?.trim() || undefined : columns[c]!.values[i]
      if (v !== undefined) cells[id] = v
    })
    return cells
  })
  addRows(db, rows)
  return rows.length
}
