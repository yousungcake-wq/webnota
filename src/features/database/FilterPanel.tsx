import { Plus, Trash2 } from 'lucide-react'
import {
  choicesOf,
  updateDbView,
  type DbDocs,
  type FieldMeta,
  type Filter,
  type FilterCond,
  type FilterGroup,
  type ViewSettings,
} from '@/core/model/database'
import { newId } from '@/core/model/views'
import { Chip } from './Chip'
import { condsFor, NO_VALUE_CONDS } from './filterConds'
import { dt, type DbKey } from './i18n'

const isGroup = (x: Filter | FilterGroup): x is FilterGroup => 'items' in x

/**
 * Filter editor (DB-G07, spec/05 §4.2): conditions joined by AND/OR, with one level of
 * nested groups (two levels in all). The whole filter is one LWW value (spec/02 §4.1).
 */
export function FilterPanel({ docs, view, fields }: { docs: DbDocs; view: ViewSettings; fields: FieldMeta[] }) {
  const root: FilterGroup = view.filter ?? { op: 'and', items: [] }
  const save = (next: FilterGroup) => updateDbView(docs, view.id, { filter: next.items.length ? next : null })
  const newFilter = (): Filter => {
    const f = fields[0]!
    return { id: newId(), fieldId: f.id, cond: condsFor(f.type)[0]! }
  }
  return (
    <div className="db-filters">
      <GroupEditor group={root} fields={fields} depth={0} onChange={save} newFilter={newFilter} />
    </div>
  )
}

function GroupEditor({
  group,
  fields,
  depth,
  onChange,
  newFilter,
}: {
  group: FilterGroup
  fields: FieldMeta[]
  depth: number
  onChange: (g: FilterGroup) => void
  newFilter: () => Filter
}) {
  const set = (i: number, item: Filter | FilterGroup | null) =>
    onChange({
      ...group,
      items: item ? group.items.map((x, k) => (k === i ? item : x)) : group.items.filter((_, k) => k !== i),
    })
  return (
    <div
      className={depth ? 'db-fgroup is-nested' : 'db-fgroup'}
      role="group"
      aria-label={depth ? dt('db.filter.group') : undefined}
    >
      {!group.items.length && <div className="db-empty">{dt('db.filter.none')}</div>}
      {group.items.map((item, i) => (
        <div key={isGroup(item) ? `g${i}` : item.id} className="db-frow">
          <span className="db-fop">
            {i === 0 ? (
              dt('db.filter.where')
            ) : i === 1 ? (
              <select
                aria-label={dt('db.filter.and') + '/' + dt('db.filter.or')}
                value={group.op}
                onChange={(e) => onChange({ ...group, op: e.target.value as 'and' | 'or' })}
              >
                <option value="and">{dt('db.filter.and')}</option>
                <option value="or">{dt('db.filter.or')}</option>
              </select>
            ) : (
              dt(group.op === 'and' ? 'db.filter.and' : 'db.filter.or')
            )}
          </span>
          {isGroup(item) ? (
            <div className="db-fnested">
              <GroupEditor
                group={item}
                fields={fields}
                depth={depth + 1}
                onChange={(g) => set(i, g.items.length ? g : null)}
                newFilter={newFilter}
              />
            </div>
          ) : (
            <FilterRow filter={item} fields={fields} onChange={(f) => set(i, f)} />
          )}
        </div>
      ))}
      <div className="db-factions">
        <button
          type="button"
          className="db-option-create"
          onClick={() => onChange({ ...group, items: [...group.items, newFilter()] })}
        >
          <Plus size={14} aria-hidden /> {dt('db.filter.add')}
        </button>
        {depth === 0 && (
          <button
            type="button"
            className="db-option-create"
            onClick={() =>
              onChange({
                ...group,
                items: [...group.items, { op: group.op === 'and' ? 'or' : 'and', items: [newFilter()] }],
              })
            }
          >
            <Plus size={14} aria-hidden /> {dt('db.filter.addGroup')}
          </button>
        )}
      </div>
    </div>
  )
}

function FilterRow({
  filter,
  fields,
  onChange,
}: {
  filter: Filter
  fields: FieldMeta[]
  onChange: (f: Filter | null) => void
}) {
  const field = fields.find((f) => f.id === filter.fieldId)
  const conds = field ? condsFor(field.type) : []
  return (
    <div className="db-filter">
      <select
        aria-label={dt('db.filter.field')}
        value={filter.fieldId}
        onChange={(e) => {
          const f = fields.find((x) => x.id === e.target.value)!
          onChange({ id: filter.id, fieldId: f.id, cond: condsFor(f.type)[0]! })
        }}
      >
        {!field && <option value={filter.fieldId}>?</option>}
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <select
        aria-label={dt('db.filter.cond')}
        value={filter.cond}
        onChange={(e) => {
          const cond = e.target.value as FilterCond
          onChange(NO_VALUE_CONDS.has(cond) ? { id: filter.id, fieldId: filter.fieldId, cond } : { ...filter, cond })
        }}
      >
        {conds.map((c) => (
          <option key={c} value={c}>
            {dt(`db.cond.${c}` as DbKey)}
          </option>
        ))}
      </select>
      {field && !NO_VALUE_CONDS.has(filter.cond) && (
        <FilterValue field={field} filter={filter} onChange={(value) => onChange({ ...filter, value })} />
      )}
      <button type="button" className="db-icon-btn" aria-label={dt('db.filter.remove')} onClick={() => onChange(null)}>
        <Trash2 size={14} aria-hidden />
      </button>
    </div>
  )
}

function FilterValue({
  field,
  filter,
  onChange,
}: {
  field: FieldMeta
  filter: Filter
  onChange: (v: unknown) => void
}) {
  const label = dt('db.filter.value')
  const numeric = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(filter.cond)
  switch (field.type === 'rollup' ? (numeric ? 'number' : 'text') : field.type) {
    case 'number':
    case 'time':
      return (
        <input
          className="db-input"
          inputMode="decimal"
          aria-label={label}
          value={filter.value === undefined ? '' : String(filter.value)}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      )
    case 'select':
    case 'multiSelect': {
      const chosen = Array.isArray(filter.value) ? (filter.value as string[]) : []
      return (
        <div className="db-fchoices" role="group" aria-label={label}>
          {choicesOf(field).map((c) => (
            <label key={c.id} className="db-fchoice">
              <input
                type="checkbox"
                checked={chosen.includes(c.id)}
                onChange={() => onChange(chosen.includes(c.id) ? chosen.filter((x) => x !== c.id) : [...chosen, c.id])}
              />
              <Chip choice={c} />
            </label>
          ))}
        </div>
      )
    }
    case 'date':
    case 'createdTime':
    case 'updatedTime': {
      if (filter.cond === 'between') {
        const r = (filter.value ?? {}) as { start?: string; end?: string }
        return (
          <span className="db-frange">
            <input
              type="date"
              className="db-input"
              aria-label={dt('db.filter.from')}
              value={r.start ?? ''}
              onChange={(e) => onChange({ ...r, start: e.target.value || undefined })}
            />
            <input
              type="date"
              className="db-input"
              aria-label={dt('db.filter.to')}
              value={r.end ?? ''}
              onChange={(e) => onChange({ ...r, end: e.target.value || undefined })}
            />
          </span>
        )
      }
      return (
        <input
          type="date"
          className="db-input"
          aria-label={label}
          value={typeof filter.value === 'string' ? filter.value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      )
    }
    default:
      return (
        <input
          className="db-input"
          aria-label={label}
          value={typeof filter.value === 'string' ? filter.value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}
