import { Check, GripVertical, MoreHorizontal, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import {
  addChoice,
  choicesOf,
  deleteChoice,
  moveChoice,
  SELECT_COLORS,
  selectedIds,
  setCell,
  updateChoice,
  type DbDocs,
  type FieldMeta,
  type SelectChoice,
} from '@/core/model/database'
import { matchRange } from '@/core/text/hangul'
import { Chip } from './Chip'
import { dt, type DbKey } from './i18n'
import { useReorder } from './useReorder'

/**
 * Option picker for select / multi-select cells (spec/05 §3.2): search, choose, create,
 * and edit options (name, colour, delete, order). Writes straight to the row.
 */
export function SelectEditor({
  docs,
  field,
  rowId,
  value,
  readOnly,
  onClose,
}: {
  docs: DbDocs
  field: FieldMeta
  rowId: string
  value: unknown
  readOnly: boolean
  onClose: () => void
}) {
  const multi = field.type === 'multiSelect'
  const choices = choicesOf(field)
  const selected = selectedIds(field, value)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const q = query.trim()
  const shown = q ? choices.filter((c) => matchRange(c.name, q) !== null) : choices
  const exact = choices.some((c) => c.name === q)
  const reorder = useReorder((from, to) => moveChoice(docs, field.id, choices[from]!.id, to))

  const choose = (id: string) => {
    if (multi)
      setCell(docs, rowId, field.id, selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
    else {
      setCell(docs, rowId, field.id, selected[0] === id ? null : id)
      onClose()
    }
  }
  const create = () => {
    if (!q) return
    const id = addChoice(docs, field.id, q)
    setQuery('')
    choose(id)
  }

  if (editing) {
    const c = choices.find((x) => x.id === editing)
    if (c) return <OptionEditor docs={docs} field={field} choice={c} onBack={() => setEditing(null)} />
  }

  return (
    <div className="db-select">
      {!readOnly && (
        <input
          className="db-input"
          autoFocus
          value={query}
          placeholder={dt('db.select.search')}
          aria-label={dt('db.select.search')}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
            e.preventDefault()
            if (shown[0] && (exact || !q || shown[0].name === q)) choose(shown[0].id)
            else create()
          }}
        />
      )}
      {selected.length > 0 && (
        <div className="db-select-current">
          {selected.map((id) => {
            const c = choices.find((x) => x.id === id)!
            return (
              <span key={id} className="db-chip-x">
                <Chip choice={c} />
                {!readOnly && (
                  <button
                    type="button"
                    className="db-chip-remove"
                    aria-label={dt('db.select.remove', { name: c.name })}
                    onClick={() => choose(id)}
                  >
                    <X size={12} aria-hidden />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}
      <div className="db-list" role="listbox" aria-label={dt('db.select.options')} aria-multiselectable={multi}>
        {shown.map((c) => {
          const i = choices.indexOf(c)
          return (
            <div key={c.id} className="db-option" data-reorder-item style={reorder.style(i)}>
              {!readOnly && !q && (
                <span className="db-grip" aria-label={dt('db.select.drag')} {...reorder.handle(i)}>
                  <GripVertical size={14} aria-hidden />
                </span>
              )}
              <button
                type="button"
                role="option"
                aria-selected={selected.includes(c.id)}
                className="db-option-main"
                disabled={readOnly}
                onClick={() => choose(c.id)}
              >
                <Chip choice={c} />
                {selected.includes(c.id) && <Check size={14} aria-hidden className="db-option-check" />}
              </button>
              {!readOnly && (
                <button
                  type="button"
                  className="db-icon-btn"
                  aria-label={dt('db.select.edit')}
                  onClick={() => setEditing(c.id)}
                >
                  <MoreHorizontal size={16} aria-hidden />
                </button>
              )}
            </div>
          )
        })}
        {!readOnly && q && !exact && (
          <button type="button" className="db-option-create" onClick={create}>
            <Plus size={14} aria-hidden /> {dt('db.select.create', { name: q })}
          </button>
        )}
        {!choices.length && !q && <div className="db-empty">{dt('db.select.none')}</div>}
      </div>
    </div>
  )
}

function OptionEditor({
  docs,
  field,
  choice,
  onBack,
}: {
  docs: DbDocs
  field: FieldMeta
  choice: SelectChoice
  onBack: () => void
}) {
  const [name, setName] = useState(choice.name)
  const save = () => {
    const v = name.trim()
    if (v && v !== choice.name) updateChoice(docs, field.id, choice.id, { name: v })
  }
  return (
    <div className="db-select">
      <input
        className="db-input"
        autoFocus
        value={name}
        aria-label={dt('db.select.name')}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            save()
            onBack()
          }
        }}
      />
      <div className="db-colors" role="radiogroup" aria-label={dt('db.select.edit')}>
        {SELECT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={choice.color === color}
            className="db-color"
            onClick={() => updateChoice(docs, field.id, choice.id, { color })}
          >
            <span className="db-color-dot" style={{ background: `var(--sel-${color})` }} />
            {dt(`db.color.${color}` as DbKey)}
            {choice.color === color && <Check size={14} aria-hidden />}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="db-option-create is-danger"
        onClick={() => {
          deleteChoice(docs, field.id, choice.id)
          onBack()
        }}
      >
        <Trash2 size={14} aria-hidden /> {dt('db.select.delete')}
      </button>
    </div>
  )
}
