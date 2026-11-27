import { generateNKeysBetween } from 'fractional-indexing'
import * as Y from 'yjs'
import { assertWritable } from '../guard'
import { dbViewsOf, readViewSettings, updateDbView, type DbDocs } from './model'
import type { GroupSettings } from './types'

type YMap = Y.Map<unknown>

// View settings operations of M5 (tabs, board grouping), on top of model.ts.

/**
 * Copies a view's settings (fields, filter, sorts, group, calcs, layout options) to a new
 * view id (M5-01 duplicate tab).
 */
export function duplicateDbView(db: DbDocs, fromId: string, toId: string) {
  assertWritable()
  const src = dbViewsOf(db).get(fromId)
  if (!src) return false
  db.schema.transact(() => {
    const m = new Y.Map<unknown>()
    for (const [k, v] of src.entries()) m.set(k, v instanceof Y.Map ? cloneMap(v as YMap) : structuredClone(v))
    dbViewsOf(db).set(toId, m)
  })
  return true
}

function cloneMap(src: YMap): YMap {
  const m = new Y.Map<unknown>()
  for (const [k, v] of src.entries()) m.set(k, v instanceof Y.Map ? cloneMap(v as YMap) : structuredClone(v))
  return m
}

/** Changes a view's board grouping (M5-02); the other group settings stay. */
export function updateGroup(db: DbDocs, viewId: string, patch: Partial<GroupSettings>) {
  const cur = readViewSettings(db, viewId)?.group
  const base: GroupSettings = cur ?? { fieldId: '', hideEmpty: false, order: {}, hidden: [] }
  // a new group field starts with fresh column order and visibility
  const reset = patch.fieldId !== undefined && patch.fieldId !== base.fieldId
  updateDbView(db, viewId, {
    group: { ...base, ...(reset ? { order: {}, hidden: [], hideEmpty: false } : {}), ...patch },
  })
}

/** Moves column `key` to `index` among `keys` (the current column order, DB-K04). */
export function moveGroup(db: DbDocs, viewId: string, keys: string[], key: string, index: number) {
  const rest = keys.filter((k) => k !== key)
  rest.splice(Math.max(0, Math.min(index, rest.length)), 0, key)
  const fk = generateNKeysBetween(null, null, rest.length)
  const order = Object.fromEntries(rest.map((k, i) => [k, fk[i]!]))
  updateGroup(db, viewId, { order })
}

/** Hides or shows a column (DB-K05). */
export function setGroupHidden(db: DbDocs, viewId: string, key: string, hidden: boolean) {
  const cur = readViewSettings(db, viewId)?.group
  if (!cur) return
  const set = new Set(cur.hidden)
  if (hidden) set.add(key)
  else set.delete(key)
  updateGroup(db, viewId, { hidden: [...set] })
}
