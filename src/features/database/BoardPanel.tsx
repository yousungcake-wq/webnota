import {
  calcsFor,
  GROUPABLE_TYPES,
  type CalcType,
  updateDbView,
  updateGroup,
  type DateUnit,
  type DbDocs,
  type FieldMeta,
  type ViewSettings,
} from '@/core/model/database'
import { Segmented, Switch } from '@/ui'
import { dt, type DbKey } from './i18n'

const UNITS: DateUnit[] = ['day', 'week', 'month', 'year']

/**
 * Board settings (DB-K01, DB-K05, DB-K06): group field (and date period), hide the
 * "no value" column, card cover. Card properties are the view's visible properties
 * (the "properties" panel), like AppFlowy.
 */
export function BoardPanel({ docs, view, fields }: { docs: DbDocs; view: ViewSettings; fields: FieldMeta[] }) {
  const groupable = fields.filter((f) => GROUPABLE_TYPES.has(f.type))
  const media = fields.filter((f) => f.type === 'media')
  const group = view.group
  const field = fields.find((f) => f.id === group?.fieldId)
  const numeric = fields.filter((f) => f.type === 'number' || f.type === 'time')
  const calcField = numeric.find((f) => f.id === view.board.calc?.fieldId)
  return (
    <div className="db-board-panel">
      <label className="db-prow">
        <span>{dt('db.board.groupBy')}</span>
        <select
          className="db-input"
          value={field && GROUPABLE_TYPES.has(field.type) ? field.id : ''}
          onChange={(e) => updateGroup(docs, view.id, { fieldId: e.target.value })}
        >
          {!field && <option value="">—</option>}
          {groupable.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      {field?.type === 'date' && (
        <Segmented
          label={dt('db.board.dateUnit')}
          value={group?.dateUnit ?? 'month'}
          options={UNITS.map((u) => ({ value: u, label: dt(`db.board.unit.${u}`) }))}
          onChange={(dateUnit) => updateGroup(docs, view.id, { dateUnit })}
        />
      )}
      {field && field.type !== 'checkbox' && (
        <Switch
          checked={!!group?.hideEmpty}
          label={dt('db.board.hideEmpty')}
          onChange={(hideEmpty) => updateGroup(docs, view.id, { hideEmpty })}
        />
      )}
      {/* a calculation in every column header (M6-08) */}
      <label className="db-prow">
        <span>{dt('db.board.calcField')}</span>
        <select
          className="db-input"
          value={calcField?.id ?? ''}
          onChange={(e) =>
            updateDbView(docs, view.id, {
              board: { ...view.board, calc: e.target.value ? { fieldId: e.target.value, calc: 'sum' } : null },
            })
          }
        >
          <option value="">{dt('db.board.calcCount')}</option>
          {numeric.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      {calcField && (
        <label className="db-prow">
          <span>{dt('db.calc.label')}</span>
          <select
            className="db-input"
            value={view.board.calc!.calc}
            onChange={(e) =>
              updateDbView(docs, view.id, {
                board: { ...view.board, calc: { fieldId: calcField.id, calc: e.target.value as CalcType } },
              })
            }
          >
            {calcsFor(calcField)
              .filter((c) => !c.startsWith('count') && !c.startsWith('percent'))
              .map((c) => (
                <option key={c} value={c}>
                  {dt(`db.calc.${c}` as DbKey)}
                </option>
              ))}
          </select>
        </label>
      )}
      <label className="db-prow">
        <span>{dt('db.board.cover')}</span>
        <select
          className="db-input"
          value={view.board.coverFieldId ?? ''}
          onChange={(e) =>
            updateDbView(docs, view.id, { board: { ...view.board, coverFieldId: e.target.value || null } })
          }
        >
          <option value="">{dt('db.board.noCover')}</option>
          {media.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
