import { t } from '@/core/i18n'
import {
  addRow,
  deleteRows,
  getRow,
  prefillFromFilter,
  restoreRows,
  type DbDocs,
  type FieldMeta,
  type RowSnapshot,
  type ViewSettings,
} from '@/core/model/database'
import { toast } from '@/ui'
import { dt } from './i18n'

/** New row (DB-G02) with values that keep it inside the view's filter (spec/05 §4.2). */
export function newRow(
  docs: DbDocs,
  fields: FieldMeta[],
  view: ViewSettings | null,
  where: { afterId?: string; beforeId?: string } = {},
): string {
  return addRow(docs, { ...where, cells: prefillFromFilter(view?.filter ?? null, fields, Date.now()) })
}

/** Deletes rows at once, with an undo toast that puts them back. */
export function deleteRowsWithUndo(docs: DbDocs, ids: string[]) {
  const snapshots = ids.map((id) => getRow(docs, id)).filter((r): r is RowSnapshot => !!r)
  if (!snapshots.length) return
  deleteRows(docs, ids)
  toast(dt('db.row.deleted', { count: snapshots.length }), {
    action: { label: t('common.undo'), onClick: () => restoreRows(docs, snapshots) },
  })
}
