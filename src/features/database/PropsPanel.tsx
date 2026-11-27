import { GripVertical } from 'lucide-react'
import {
  moveViewField,
  orderedFields,
  setViewField,
  type DbDocs,
  type FieldMeta,
  type ViewSettings,
} from '@/core/model/database'
import { Switch } from '@/ui'
import { FIELD_TYPE_INFO } from './fieldTypes'
import { dt } from './i18n'
import { useReorder } from './useReorder'

/** Property visibility and order for the view (DB-F04). The primary field always shows. */
export function PropsPanel({
  docs,
  view,
  fields,
  primaryId,
}: {
  docs: DbDocs
  view: ViewSettings
  fields: FieldMeta[]
  primaryId: string
}) {
  const ordered = orderedFields(fields, view)
  const reorder = useReorder((from, to) => moveViewField(docs, view.id, ordered[from]!.id, to))
  const setAll = (visible: boolean) =>
    ordered.forEach((f) => f.id !== primaryId && setViewField(docs, view.id, f.id, { visible }))
  return (
    <div className="db-props">
      <div className="db-factions">
        <button type="button" className="db-option-create" onClick={() => setAll(true)}>
          {dt('db.props.showAll')}
        </button>
        <button type="button" className="db-option-create" onClick={() => setAll(false)}>
          {dt('db.props.hideAll')}
        </button>
      </div>
      <div className="db-list">
        {ordered.map((f, i) => {
          const Icon = FIELD_TYPE_INFO[f.type].icon
          return (
            <div key={f.id} className="db-option db-prop-row" data-reorder-item style={reorder.style(i)}>
              <span className="db-grip" {...reorder.handle(i)}>
                <GripVertical size={14} aria-hidden />
              </span>
              <Icon size={14} aria-hidden />
              <Switch
                checked={view.fields[f.id]?.visible !== false}
                disabled={f.id === primaryId}
                label={f.name}
                onChange={(on) => setViewField(docs, view.id, f.id, { visible: on })}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
