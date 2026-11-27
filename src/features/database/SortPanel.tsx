import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { updateDbView, type DbDocs, type FieldMeta, type Sort, type ViewSettings } from '@/core/model/database'
import { newId } from '@/core/model/views'
import { dt } from './i18n'
import { useReorder } from './useReorder'

/** Sort editor (DB-G07, spec/05 §4.1): several sorts applied in order; drag to reprioritise. */
export function SortPanel({ docs, view, fields }: { docs: DbDocs; view: ViewSettings; fields: FieldMeta[] }) {
  const sorts = view.sorts
  const save = (next: Sort[]) => updateDbView(docs, view.id, { sorts: next })
  const reorder = useReorder((from, to) => {
    const next = [...sorts]
    const [s] = next.splice(from, 1)
    next.splice(to, 0, s!)
    save(next)
  })
  const unused = fields.filter((f) => !sorts.some((s) => s.fieldId === f.id))
  return (
    <div className="db-sorts">
      {!sorts.length && <div className="db-empty">{dt('db.sort.none')}</div>}
      <div className="db-list">
        {sorts.map((s, i) => (
          <div key={s.id} className="db-option db-sort" data-reorder-item style={reorder.style(i)}>
            <span className="db-grip" {...reorder.handle(i)}>
              <GripVertical size={14} aria-hidden />
            </span>
            <select
              aria-label={dt('db.filter.field')}
              value={s.fieldId}
              onChange={(e) => save(sorts.map((x) => (x.id === s.id ? { ...x, fieldId: e.target.value } : x)))}
            >
              {fields
                .filter((f) => f.id === s.fieldId || !sorts.some((x) => x.fieldId === f.id))
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
            <select
              aria-label={dt('db.sort.dir')}
              value={s.dir}
              onChange={(e) =>
                save(sorts.map((x) => (x.id === s.id ? { ...x, dir: e.target.value as 'asc' | 'desc' } : x)))
              }
            >
              <option value="asc">{dt('db.sort.asc')}</option>
              <option value="desc">{dt('db.sort.desc')}</option>
            </select>
            <button
              type="button"
              className="db-icon-btn"
              aria-label={dt('db.sort.remove')}
              onClick={() => save(sorts.filter((x) => x.id !== s.id))}
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
        ))}
      </div>
      {unused.length > 0 && (
        <button
          type="button"
          className="db-option-create"
          onClick={() => save([...sorts, { id: newId(), fieldId: unused[0]!.id, dir: 'asc' }])}
        >
          <Plus size={14} aria-hidden /> {dt('db.sort.add')}
        </button>
      )}
      {sorts.length > 0 && (
        <button type="button" className="db-option-create is-danger" onClick={() => save([])}>
          <Trash2 size={14} aria-hidden /> {dt('db.sort.clear')}
        </button>
      )}
    </div>
  )
}
