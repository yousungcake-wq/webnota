import type * as Y from 'yjs'
import { getView, listViews } from '../views'
import { asStrings, cellOf } from './cells'
import { addField, getRow, readDbMeta, setCell, type DbDocs } from './model'
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
