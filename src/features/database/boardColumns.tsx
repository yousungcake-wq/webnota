import { EyeOff, Palette, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  addChoice,
  choicesOf,
  deleteChoice,
  NO_VALUE,
  SELECT_COLORS,
  setGroupHidden,
  updateChoice,
  updateGroup,
  type DbDocs,
  type FieldMeta,
  type QueryGroup,
} from '@/core/model/database'
import { confirmDialog, promptDialog, type MenuEntry } from '@/ui'
import { GroupLabel } from './GroupLabel'
import { dt, type DbKey } from './i18n'

/**
 * Column menu (M5-05, DB-K04): a select column is its option — rename and colour change
 * the option for every view; delete removes the option (its cards go to "no value").
 * Any column can be hidden; the "no value" column hides through `hideEmpty`.
 */
export function columnMenu(
  docs: DbDocs,
  viewId: string,
  field: FieldMeta,
  key: string,
  hideEmpty: boolean,
): MenuEntry[] {
  const choice = key !== NO_VALUE ? choicesOf(field).find((c) => c.id === key) : undefined
  const hide: MenuEntry = {
    label: dt('db.board.hideGroup'),
    icon: EyeOff,
    onSelect: () =>
      key === NO_VALUE && !hideEmpty
        ? updateGroup(docs, viewId, { hideEmpty: true })
        : setGroupHidden(docs, viewId, key, true),
  }
  if (!choice) return [hide]
  return [
    {
      label: dt('db.board.renameGroup'),
      icon: Pencil,
      onSelect: async () => {
        const name = await promptDialog({
          title: dt('db.board.renameGroup'),
          label: dt('db.select.name'),
          value: choice.name,
        })
        if (name?.trim()) updateChoice(docs, field.id, choice.id, { name: name.trim() })
      },
    },
    {
      label: dt('db.board.color'),
      icon: Palette,
      children: SELECT_COLORS.map((color) => ({
        label: dt(`db.color.${color}` as DbKey),
        checked: choice.color === color,
        onSelect: () => updateChoice(docs, field.id, choice.id, { color }),
      })),
    },
    hide,
    'separator',
    {
      label: dt('db.select.delete'),
      icon: Trash2,
      danger: true,
      onSelect: async () => {
        const ok = await confirmDialog({
          title: dt('db.board.deleteGroup', { name: choice.name }),
          message: dt('db.board.deleteGroupHint'),
          confirmLabel: dt('db.select.delete'),
          danger: true,
        })
        if (ok) deleteChoice(docs, field.id, choice.id)
      },
    },
  ]
}

/** "New group" (DB-K04): a new option of the group field. */
export async function addGroup(docs: DbDocs, field: FieldMeta) {
  const name = await promptDialog({ title: dt('db.board.addGroup'), label: dt('db.select.name'), value: '' })
  if (name?.trim()) addChoice(docs, field.id, name.trim())
}

/** Hidden columns with their card counts, each with "show" (DB-K05), and "new group". */
export function HiddenGroups({
  field,
  groups,
  readOnly,
  canAdd,
  onShow,
  onAdd,
}: {
  field: FieldMeta
  groups: QueryGroup[]
  readOnly: boolean
  canAdd: boolean
  onShow: (key: string) => void
  onAdd: () => void
}) {
  return (
    <aside className="dbk-side" aria-label={dt('db.board.hiddenGroups')}>
      {canAdd && (
        <button type="button" className="dbk-new dbk-add-group" onClick={onAdd}>
          <Plus size={14} aria-hidden />
          {dt('db.board.addGroup')}
        </button>
      )}
      {groups.length > 0 && (
        <>
          <div className="dbk-side-title">{dt('db.board.hiddenGroups')}</div>
          {groups.map((g) => (
            <div key={g.key} className="dbk-hidden" data-group={g.key}>
              <GroupLabel field={field} groupKey={g.key} />
              <span className="dbk-count">{g.rowIds.length}</span>
              {!readOnly && (
                <button type="button" className="db-option-create dbk-show" onClick={() => onShow(g.key)}>
                  {dt('db.board.showGroup')}
                </button>
              )}
            </div>
          ))}
        </>
      )}
    </aside>
  )
}
