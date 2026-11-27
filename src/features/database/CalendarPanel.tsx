import {
  DEFAULT_CALENDAR,
  updateDbView,
  type CalendarSettings,
  type DbDocs,
  type FieldMeta,
  type ViewSettings,
} from '@/core/model/database'
import { Segmented, Switch } from '@/ui'
import { dt } from './i18n'

/** Calendar settings (DB-C02, DB-C06): date field, first day of the week, weekends, week numbers. */
export function CalendarPanel({ docs, view, fields }: { docs: DbDocs; view: ViewSettings; fields: FieldMeta[] }) {
  const s = view.calendar ?? DEFAULT_CALENDAR
  const set = (patch: Partial<CalendarSettings>) => updateDbView(docs, view.id, { calendar: { ...s, ...patch } })
  const dates = fields.filter((f) => f.type === 'date' || f.type === 'createdTime' || f.type === 'updatedTime')
  return (
    <div className="db-board-panel">
      <label className="db-prow">
        <span>{dt('db.cal.dateBy')}</span>
        <select className="db-input" value={s.dateFieldId ?? ''} onChange={(e) => set({ dateFieldId: e.target.value })}>
          {!dates.some((f) => f.id === s.dateFieldId) && <option value="">—</option>}
          {dates.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <Segmented
        label={dt('db.cal.firstDay')}
        value={String(s.firstDayOfWeek) as '0' | '1'}
        options={[
          { value: '0', label: dt('db.cal.sunday') },
          { value: '1', label: dt('db.cal.monday') },
        ]}
        onChange={(v) => set({ firstDayOfWeek: v === '1' ? 1 : 0 })}
      />
      <Switch
        checked={s.showWeekends}
        label={dt('db.cal.weekends')}
        onChange={(showWeekends) => set({ showWeekends })}
      />
      <Switch
        checked={s.showWeekNumbers}
        label={dt('db.cal.weekNumbers')}
        onChange={(showWeekNumbers) => set({ showWeekNumbers })}
      />
    </div>
  )
}
