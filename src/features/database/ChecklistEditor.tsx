import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { asChecklist, setCell, type ChecklistItem, type DbDocs, type FieldMeta } from '@/core/model/database'
import { newId } from '@/core/model/views'
import { Switch } from '@/ui'
import { dt } from './i18n'
import { useReorder } from './useReorder'

/** Checklist cell editor (spec/05 §3.2): add, check, rename, delete, reorder, hide completed. */
export function ChecklistEditor({
  docs,
  field,
  rowId,
  value,
  readOnly,
}: {
  docs: DbDocs
  field: FieldMeta
  rowId: string
  value: unknown
  readOnly: boolean
}) {
  const items = asChecklist(value)
  const [hideDone, setHideDone] = useState(false)
  const [draft, setDraft] = useState('')
  const write = (next: ChecklistItem[]) => setCell(docs, rowId, field.id, next.length ? next : null)
  const reorder = useReorder((from, to) => {
    const next = [...items]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it!)
    write(next)
  })
  const done = items.filter((i) => i.done).length
  const add = () => {
    const name = draft.trim()
    if (!name) return
    write([...items, { id: newId(), name, done: false }])
    setDraft('')
  }

  return (
    <div className="db-checklist">
      <div className="db-progress" aria-label={dt('db.check.progress', { done, total: items.length })}>
        <span className="db-progress-bar">
          <span style={{ width: items.length ? `${(done / items.length) * 100}%` : 0 }} />
        </span>
        <span>{items.length ? `${Math.round((done / items.length) * 100)}%` : ''}</span>
      </div>
      <div className="db-list">
        {items.map((it, i) =>
          hideDone && it.done ? null : (
            <div key={it.id} className="db-option" data-reorder-item style={reorder.style(i)}>
              {!readOnly && (
                <span className="db-grip" {...reorder.handle(i)}>
                  <GripVertical size={14} aria-hidden />
                </span>
              )}
              <input
                type="checkbox"
                checked={it.done}
                disabled={readOnly}
                aria-label={it.name}
                onChange={() => write(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))}
              />
              <ItemName
                name={it.name}
                readOnly={readOnly}
                onRename={(name) => write(items.map((x) => (x.id === it.id ? { ...x, name } : x)))}
              />
              {!readOnly && (
                <button
                  type="button"
                  className="db-icon-btn"
                  aria-label={dt('db.check.delete')}
                  onClick={() => write(items.filter((x) => x.id !== it.id))}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              )}
            </div>
          ),
        )}
        {!items.length && <div className="db-empty">{dt('db.check.empty')}</div>}
      </div>
      {!readOnly && (
        <div className="db-check-add">
          <input
            className="db-input"
            autoFocus
            value={draft}
            placeholder={dt('db.check.add')}
            aria-label={dt('db.check.add')}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                add()
              }
            }}
          />
          <button type="button" className="db-icon-btn" aria-label={dt('db.check.add')} onClick={add}>
            <Plus size={16} aria-hidden />
          </button>
        </div>
      )}
      <Switch checked={hideDone} label={dt('db.check.hideDone')} onChange={setHideDone} />
    </div>
  )
}

function ItemName({ name, readOnly, onRename }: { name: string; readOnly: boolean; onRename: (n: string) => void }) {
  const [text, setText] = useState(name)
  const [focused, setFocused] = useState(false)
  return (
    <input
      className="db-input is-plain"
      value={focused ? text : name}
      readOnly={readOnly}
      aria-label={dt('db.check.item')}
      onFocus={() => {
        setText(name)
        setFocused(true)
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false)
        if (text.trim() && text !== name) onRename(text.trim())
      }}
      onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && e.currentTarget.blur()}
    />
  )
}
