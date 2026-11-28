import type * as Y from 'yjs'
import { getView, listViews } from '../views'
import { asStrings, cellOf } from './cells'
import {
  addField,
  getField,
  getRow,
  listFields,
  listRows,
  readDbMeta,
  setCell,
  setFieldOptions,
  type DbDocs,
} from './model'
import type { CellValue, FieldMeta, RowSnapshot } from './types'

/**
 * Relation fields (M6-01, spec/05 §10, spec/02 §4.3): a cell holds target row ids
 * (`rowId[]`, order kept, no duplicates). The field points at a database by id only
 * (`targetDatabaseId`, the same database allowed), so a target in another space — a
 * separate repository after M9 (DECISIONS 021) — stays a plain id; `databaseSpaceId`
 * tells the UI where the target lives. Two-way links (`twoWay`, `pairedFieldId`) are M6-03.
 */
export interface RelationOptions {
  targetDatabaseId: string | null
  twoWay: boolean
  pairedFieldId: string | null
}

export function relationOptions(field: FieldMeta): RelationOptions {
  const o = field.options
  return {
    targetDatabaseId: typeof o.targetDatabaseId === 'string' && o.targetDatabaseId ? o.targetDatabaseId : null,
    twoWay: o.twoWay === true,
    pairedFieldId: typeof o.pairedFieldId === 'string' && o.pairedFieldId ? o.pairedFieldId : null,
  }
}

/** Target row ids of a cell: strings only, first occurrence kept. */
export const relationIds = (v: unknown): string[] => [...new Set(asStrings(v))]

/** A relation cell's ids that still exist in the target (deleted target rows read as gone). */
export function liveRelationIds(field: FieldMeta, row: RowSnapshot, exists: (id: string) => boolean): string[] {
  return relationIds(cellOf(field, row)).filter(exists)
}

export function addRelationField(
  db: DbDocs,
  opts: { name: string; targetDatabaseId: string; viewId?: string; id?: string },
): string {
  return addField(db, {
    name: opts.name,
    type: 'relation',
    options: { targetDatabaseId: opts.targetDatabaseId, twoWay: false, pairedFieldId: null },
    viewId: opts.viewId,
    id: opts.id,
  })
}

/** Replaces a row's links (deduplicated); an empty list clears the cell. */
export function setRelation(db: DbDocs, rowId: string, fieldId: string, ids: string[]) {
  const unique = [...new Set(ids)]
  setCell(db, rowId, fieldId, unique.length ? (unique as CellValue) : undefined)
}

export function linkRow(db: DbDocs, rowId: string, fieldId: string, targetRowId: string) {
  const row = getRow(db, rowId)
  const ids = relationIds(row?.cells[fieldId])
  if (!ids.includes(targetRowId)) setRelation(db, rowId, fieldId, [...ids, targetRowId])
}

export function unlinkRow(db: DbDocs, rowId: string, fieldId: string, targetRowId: string) {
  const row = getRow(db, rowId)
  const ids = relationIds(row?.cells[fieldId])
  if (ids.includes(targetRowId))
    setRelation(
      db,
      rowId,
      fieldId,
      ids.filter((id) => id !== targetRowId),
    )
}

/** Titles (primary field) of target rows, in cell order; missing rows are skipped. */
export function relationTitles(target: DbDocs, ids: string[]): { id: string; title: string }[] {
  const primary = readDbMeta(target).primaryFieldId
  const out: { id: string; title: string }[] = []
  for (const id of ids) {
    const r = getRow(target, id)
    if (r) out.push({ id, title: typeof r.cells[primary] === 'string' ? (r.cells[primary] as string) : '' })
  }
  return out
}

/**
 * The space a database lives in: the space of its first sidebar view (an inline database:
 * of its embedded view). '' when no view points at it.
 */
export function databaseSpaceId(ws: Y.Doc, dbId: string): string {
  const listed = listViews(ws).find((v) => v.databaseId === dbId && !v.deletedAt)
  if (listed) return listed.spaceId
  let space = ''
  ws.getMap<Y.Map<unknown>>('views').forEach((m, id) => {
    if (!space && m.get('databaseId') === dbId) space = getView(ws, id)?.spaceId ?? ''
  })
  return space
}

// ---------- two-way relations (M6-03, spec/05 §10) ----------

/** The paired field of a two-way relation in the target docs, if both sides still agree. */
export function pairedField(field: FieldMeta, target: DbDocs): FieldMeta | null {
  const o = relationOptions(field)
  if (!o.twoWay || !o.pairedFieldId) return null
  const p = getField(target, o.pairedFieldId)
  return p && p.type === 'relation' ? p : null
}

/**
 * Turns a relation two-way: a paired relation field in the target database (`pairedName`)
 * pointing back, both marked `twoWay` and naming each other; existing links are mirrored.
 * `selfId` / `targetId` are the two database ids (equal for a relation inside one database).
 */
export function enableTwoWay(
  self: DbDocs,
  target: DbDocs,
  fieldId: string,
  opts: { selfId: string; targetId: string; pairedName: string },
): string {
  const field = getField(self, fieldId)
  if (!field || field.type !== 'relation') throw new Error('not a relation field')
  const existing = pairedField(field, target)
  if (existing) return existing.id
  const pairedId = addField(target, {
    name: opts.pairedName,
    type: 'relation',
    options: { targetDatabaseId: opts.selfId, twoWay: true, pairedFieldId: fieldId },
  })
  setFieldOptions(self, fieldId, { targetDatabaseId: opts.targetId, twoWay: true, pairedFieldId: pairedId })
  repairTwoWay(self, target, fieldId)
  return pairedId
}

/** Back to one-way on both sides; every link stays. */
export function disableTwoWay(self: DbDocs, target: DbDocs, fieldId: string) {
  const field = getField(self, fieldId)
  if (!field) return
  const paired = pairedField(field, target)
  setFieldOptions(self, fieldId, { twoWay: false, pairedFieldId: null })
  if (paired) setFieldOptions(target, paired.id, { twoWay: false, pairedFieldId: null })
}

/**
 * Sets a row's links; on a two-way relation the other side follows (added links get the
 * row back, removed ones lose it). Two docs, so not atomic — `repairTwoWay` heals the rest.
 */
export function setLinks(self: DbDocs, target: DbDocs | null, fieldId: string, rowId: string, ids: string[]) {
  const field = getField(self, fieldId)
  if (!field) return
  const before = relationIds(getRow(self, rowId)?.cells[fieldId])
  setRelation(self, rowId, fieldId, ids)
  const paired = target ? pairedField(field, target) : null
  if (!target || !paired) return
  const after = new Set(ids)
  for (const id of ids) if (!before.includes(id) && getRow(target, id)) linkRow(target, id, paired.id, rowId)
  for (const id of before) if (!after.has(id) && getRow(target, id)) unlinkRow(target, id, paired.id, rowId)
}

/**
 * Makes both sides of a two-way relation agree after merges (concurrent edits on two
 * devices, or a write that reached only one doc). A link present on either side is kept
 * (union): it never loses an intended link, and both sides are written by every edit, so an
 * unlink only comes back if it raced a link of the same pair. Returns the fixes made.
 */
export function repairTwoWay(self: DbDocs, target: DbDocs, fieldId: string): number {
  const field = getField(self, fieldId)
  const paired = field ? pairedField(field, target) : null
  if (!field || !paired) return 0
  let fixes = 0
  const mirror = (from: DbDocs, f: FieldMeta, to: DbDocs, p: FieldMeta) => {
    for (const row of listRows(from))
      for (const id of relationIds(row.cells[f.id])) {
        const other = getRow(to, id)
        if (other && !relationIds(other.cells[p.id]).includes(row.id)) {
          linkRow(to, id, p.id, row.id)
          fixes++
        }
      }
  }
  mirror(self, field, target, paired)
  mirror(target, paired, self, field)
  return fixes
}

/** Two-way relation fields of a database whose pair lives in `target` (for repair runs). */
export const twoWayFieldsTo = (self: DbDocs, targetId: string, selfId: string) =>
  listFields(self).filter(
    (f) =>
      f.type === 'relation' &&
      relationOptions(f).twoWay &&
      (relationOptions(f).targetDatabaseId ?? selfId) === targetId,
  )
