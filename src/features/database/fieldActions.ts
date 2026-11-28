import { t } from '@/core/i18n'
import {
  convertField,
  disableTwoWay,
  planConversion,
  relationIds,
  relationTitles,
  type DbDocs,
  type FieldMeta,
  type FieldType,
} from '@/core/model/database'
import { confirmDialog, toast } from '@/ui'
import { FIELD_TYPE_INFO } from './fieldTypes'
import { dt } from './i18n'

/** How long a type conversion can be undone (spec/05 §3.4). */
export const CONVERT_UNDO_MS = 30_000

/**
 * Changes a field's type (DB-F02): converts the cells (spec/05 §3.4), asks first when
 * values would disappear, and offers undo for 30 seconds.
 */
export async function changeFieldType(
  docs: DbDocs,
  field: FieldMeta,
  to: FieldType,
  /** A relation's target docs: its titles become the text (M6-05); a two-way pair goes one-way. */
  target?: DbDocs | null,
): Promise<boolean> {
  if (field.type === to) return false
  const textOf =
    field.type === 'relation' && target
      ? (v: unknown) =>
          relationTitles(target, relationIds(v))
            .map((r) => r.title)
            .join(', ')
      : undefined
  const { lostCount } = planConversion(docs, field.id, to, textOf)
  if (lostCount > 0) {
    const ok = await confirmDialog({
      title: dt('db.convert.title', { type: dt(FIELD_TYPE_INFO[to].label) }),
      message: dt('db.convert.lost', { count: lostCount }),
      confirmLabel: dt('db.convert.confirm'),
      danger: true,
    })
    if (!ok) return false
  }
  if (field.type === 'relation' && target) disableTwoWay(docs, target, field.id)
  const undo = convertField(docs, field.id, to, textOf)
  if (undo)
    toast(dt('db.convert.done', { name: field.name, type: dt(FIELD_TYPE_INFO[to].label) }), {
      action: { label: t('common.undo'), onClick: undo },
      duration: CONVERT_UNDO_MS,
    })
  return true
}
