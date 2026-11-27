import { useState } from 'react'
import { cellOf, setCell, type FieldMeta, type RowSnapshot } from '@/core/model/database'
import { CellEditor } from './CellEditor'
import { ChecklistEditor } from './ChecklistEditor'
import { CellView } from './CellView'
import { DateEditor } from './DateEditor'
import { FIELD_TYPE_INFO } from './fieldTypes'
import { dt } from './i18n'
import { MediaEditor } from './MediaEditor'
import { SelectEditor } from './SelectEditor'
import { editText, parseEdit, TEXT_EDITED } from './cellEdit'
import type { DbState } from './session'

const READ_ONLY_TYPES = new Set(['createdTime', 'updatedTime', 'rollup'])
const POPOVER_TYPES = new Set(['select', 'multiSelect', 'date', 'checklist', 'media'])

/** One property of a row on the row page (M5-08): name and value, edited in place. */
export function RowProperty({
  state,
  field,
  row,
  readOnly,
}: {
  state: DbState
  field: FieldMeta
  row: RowSnapshot
  readOnly: boolean
}) {
  const [open, setOpen] = useState(false)
  readOnly = readOnly || READ_ONLY_TYPES.has(field.type)
  const Icon = FIELD_TYPE_INFO[field.type]?.icon
  const value = cellOf(field, row)
  const props = { docs: state.docs, field, rowId: row.id, value, readOnly }
  let editor: React.ReactNode = null
  if (open && (!readOnly || POPOVER_TYPES.has(field.type))) {
    if (TEXT_EDITED.has(field.type) && !readOnly)
      editor = (
        <div className="db-rowsheet-input">
          <CellEditor
            field={field}
            initial={editText(field, value)}
            onDone={(text) => {
              setOpen(false)
              if (text === null) return
              const v = parseEdit(field, text)
              if (v !== undefined) setCell(state.docs, row.id, field.id, v)
            }}
          />
        </div>
      )
    else if (field.type === 'select' || field.type === 'multiSelect')
      editor = <SelectEditor {...props} onClose={() => setOpen(false)} />
    else if (field.type === 'date') editor = <DateEditor {...props} />
    else if (field.type === 'checklist') editor = <ChecklistEditor {...props} />
    else if (field.type === 'media') editor = <MediaEditor {...props} />
  }
  return (
    <div className="db-prop">
      <div className="db-prop-name">
        {Icon && <Icon size={14} aria-hidden />}
        <span>{field.name}</span>
      </div>
      <div className="db-prop-value">
        {editor ??
          (field.type === 'checkbox' ? (
            <CellView
              field={field}
              value={value}
              wrap
              readOnly={readOnly}
              onToggle={() => setCell(state.docs, row.id, field.id, value !== true)}
            />
          ) : (
            <button
              type="button"
              className="db-prop-btn"
              aria-label={field.name}
              disabled={readOnly && !POPOVER_TYPES.has(field.type)}
              onClick={() => setOpen(true)}
            >
              <CellView field={field} value={value} wrap readOnly={readOnly} onToggle={() => {}} />
              {value === undefined || value === null || value === '' ? (
                <span className="db-prop-empty">{dt('db.row.empty')}</span>
              ) : null}
            </button>
          ))}
      </div>
    </div>
  )
}
