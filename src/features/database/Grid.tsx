import { memo, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  cellOf,
  orderedFields,
  setCell,
  type FieldMeta,
  type RowSnapshot,
  type ViewSettings,
} from '@/core/model/database'
import type { DbSession, DbState } from './session'
import { FIELD_TYPE_INFO } from './fieldTypes'
import { dt } from './i18n'
import { CellEditor } from './CellEditor'
import { CellPopover, POPOVER_EDITED } from './CellPopover'
import { CellView } from './CellView'
import { editText, parseEdit, TEXT_EDITED } from './cellEdit'
import { useRowWindow } from './useRowWindow'
import './grid.css'

export const ROW_HEIGHT = 36
export const HEADER_HEIGHT = 36
const READ_ONLY_TYPES = new Set(['createdTime', 'updatedTime', 'rollup'])

interface Pos {
  rowId: string
  fieldId: string
}
interface Column {
  field: FieldMeta
  width: number
  wrap: boolean
  left: number
  frozen: boolean
}

/** The view's visible columns with their offsets (frozen ones first). */
export function columnsOf(fields: FieldMeta[], view: ViewSettings | null): Column[] {
  if (!view) return []
  let left = 0
  return orderedFields(fields, view)
    .filter((f) => view.fields[f.id]?.visible !== false)
    .map((field, i) => {
      const s = view.fields[field.id]
      const col = { field, width: s?.width ?? 180, wrap: s?.wrap ?? false, left, frozen: i < view.frozenColumns }
      left += col.width
      return col
    })
}

/** Grid layout (DB-G01…): virtual rows, sticky header, frozen first column. */
export function Grid({
  session,
  state,
  title,
  readOnly,
}: {
  session: DbSession
  state: DbState
  title: string
  readOnly: boolean
}) {
  const columns = useMemo(() => columnsOf(state.fields, state.view), [state.fields, state.view])
  const rowIds = state.result.rowIds
  const scrollRef = useRef<HTMLDivElement>(null)
  const win = useRowWindow(scrollRef, rowIds.length, ROW_HEIGHT, HEADER_HEIGHT)
  const [active, setActive] = useState<Pos | null>(null)
  const [editing, setEditing] = useState<(Pos & { initial: string }) | null>(null)
  const [popover, setPopover] = useState<Pos | null>(null)
  const totalWidth = columns.reduce((n, c) => n + c.width, 0)
  const docs = state.docs

  const fieldById = (id: string) => columns.find((c) => c.field.id === id)?.field
  const canEdit = (f: FieldMeta | undefined) => !!f && !readOnly && !READ_ONLY_TYPES.has(f.type)

  const startEdit = (pos: Pos, initial?: string) => {
    const field = fieldById(pos.fieldId)
    if (field && POPOVER_EDITED.has(field.type) && initial === undefined) {
      setPopover(pos) // read-only views still open it to show the whole value
      return true
    }
    if (!canEdit(field) || !TEXT_EDITED.has(field!.type)) return false
    const row = session.row(pos.rowId)
    setEditing({ ...pos, initial: initial ?? (row ? editText(field!, cellOf(field!, row)) : '') })
    return true
  }
  const toggle = (pos: Pos) => {
    const field = fieldById(pos.fieldId)
    const row = session.row(pos.rowId)
    if (canEdit(field) && field!.type === 'checkbox' && row)
      setCell(docs, pos.rowId, pos.fieldId, row.cells[pos.fieldId] !== true)
  }
  const move = (dRow: number, dCol: number) => {
    if (!active) {
      if (rowIds[0] && columns[0]) setActive({ rowId: rowIds[0], fieldId: columns[0].field.id })
      return
    }
    const r = Math.max(0, Math.min(rowIds.length - 1, rowIds.indexOf(active.rowId) + dRow))
    const c = Math.max(0, Math.min(columns.length - 1, columns.findIndex((x) => x.field.id === active.fieldId) + dCol))
    const next = { rowId: rowIds[r]!, fieldId: columns[c]!.field.id }
    setActive(next)
    scrollIntoView(next)
  }
  const scrollIntoView = (pos: Pos) => {
    const el = scrollRef.current
    if (!el) return
    const i = rowIds.indexOf(pos.rowId)
    const top = HEADER_HEIGHT + i * ROW_HEIGHT
    if (top < el.scrollTop + HEADER_HEIGHT) el.scrollTop = top - HEADER_HEIGHT
    else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_HEIGHT - el.clientHeight
    const col = columns.find((c) => c.field.id === pos.fieldId)
    if (col && !col.frozen) {
      const frozenW = columns.filter((c) => c.frozen).reduce((n, c) => n + c.width, 0)
      if (col.left < el.scrollLeft + frozenW) el.scrollLeft = col.left - frozenW
      else if (col.left + col.width > el.scrollLeft + el.clientWidth)
        el.scrollLeft = col.left + col.width - el.clientWidth
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing || popover || e.nativeEvent.isComposing) return
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(1, 0),
      ArrowUp: () => move(-1, 0),
      ArrowRight: () => move(0, 1),
      ArrowLeft: () => move(0, -1),
      Tab: () => move(0, e.shiftKey ? -1 : 1),
      Enter: () => active && (startEdit(active) || toggle(active)),
      ' ': () => active && toggle(active),
      Escape: () => setActive(null),
      Delete: () => active && canEdit(fieldById(active.fieldId)) && setCell(docs, active.rowId, active.fieldId, null),
      Backspace: () =>
        active && canEdit(fieldById(active.fieldId)) && setCell(docs, active.rowId, active.fieldId, null),
    }
    const run = keys[e.key]
    if (run) {
      e.preventDefault()
      run()
    } else if (active && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // typing on a cell replaces its content (spreadsheet behaviour)
      if (startEdit(active, e.key)) e.preventDefault()
    }
  }

  const finishEdit = (text: string | null, moveTo?: 'down' | 'right' | 'left') => {
    const pos = editing
    setEditing(null)
    if (pos && text !== null) {
      const field = fieldById(pos.fieldId)
      const value = field ? parseEdit(field, text) : undefined
      if (value !== undefined) setCell(docs, pos.rowId, pos.fieldId, value)
    }
    scrollRef.current?.focus({ preventScroll: true })
    if (moveTo === 'down') move(1, 0)
    else if (moveTo === 'right') move(0, 1)
    else if (moveTo === 'left') move(0, -1)
  }

  return (
    <div
      ref={scrollRef}
      className="dbg"
      role="grid"
      aria-label={dt('db.grid.label', { title })}
      aria-rowcount={rowIds.length + 1}
      aria-colcount={columns.length}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div className="dbg-header" role="row" aria-rowindex={1} style={{ width: totalWidth, height: HEADER_HEIGHT }}>
        {columns.map((c, i) => (
          <HeaderCell key={c.field.id} col={c} index={i} />
        ))}
        <div className="dbg-fill" />
      </div>
      <div className="dbg-body" style={{ width: totalWidth, height: rowIds.length * ROW_HEIGHT }}>
        {rowIds.slice(win.start, win.end).map((id, k) => {
          const row = session.row(id)
          if (!row) return null
          const index = win.start + k
          return (
            <GridRow
              key={id}
              row={row}
              index={index}
              columns={columns}
              readOnly={readOnly}
              activeField={active?.rowId === id ? active.fieldId : null}
              editing={editing?.rowId === id ? editing : null}
              onCellPointer={(fieldId, e) => {
                const pos = { rowId: id, fieldId }
                if (active?.rowId === id && active.fieldId === fieldId && !editing && !popover) {
                  // keep the browser from moving focus back to the grid after the editor took it
                  if (startEdit(pos)) e.preventDefault()
                } else setActive(pos)
              }}
              onToggle={(fieldId) => {
                setActive({ rowId: id, fieldId })
                toggle({ rowId: id, fieldId })
              }}
              onFinishEdit={finishEdit}
            />
          )
        })}
      </div>
      {popover && (
        <GridPopover
          pos={popover}
          session={session}
          state={state}
          readOnly={readOnly}
          onClose={() => {
            setPopover(null)
            scrollRef.current?.focus({ preventScroll: true })
          }}
        />
      )}
    </div>
  )
}

function GridPopover({
  pos,
  session,
  state,
  readOnly,
  onClose,
}: {
  pos: Pos
  session: DbSession
  state: DbState
  readOnly: boolean
  onClose: () => void
}) {
  const field = state.fields.find((f) => f.id === pos.fieldId)
  const row = session.row(pos.rowId)
  if (!field || !row) return null
  const anchor = document.querySelector<HTMLElement>(
    `.dbg-row[data-row-id="${CSS.escape(pos.rowId)}"] [data-field-id="${CSS.escape(pos.fieldId)}"]`,
  )
  return <CellPopover docs={state.docs} field={field} row={row} anchor={anchor} readOnly={readOnly} onClose={onClose} />
}

function HeaderCell({ col, index }: { col: Column; index: number }) {
  const Icon = FIELD_TYPE_INFO[col.field.type]?.icon
  return (
    <div
      className={`dbg-hcell${col.frozen ? ' is-frozen' : ''}`}
      role="columnheader"
      aria-colindex={index + 1}
      style={{ width: col.width, left: col.frozen ? col.left : undefined }}
    >
      {Icon && <Icon size={14} aria-hidden className="dbg-hicon" />}
      <span className="dbg-hname">{col.field.name}</span>
    </div>
  )
}

const GridRow = memo(function GridRow({
  row,
  index,
  columns,
  readOnly,
  activeField,
  editing,
  onCellPointer,
  onToggle,
  onFinishEdit,
}: {
  row: RowSnapshot
  index: number
  columns: Column[]
  readOnly: boolean
  activeField: string | null
  editing: (Pos & { initial: string }) | null
  onCellPointer: (fieldId: string, e: React.PointerEvent) => void
  onToggle: (fieldId: string) => void
  onFinishEdit: (text: string | null, move?: 'down' | 'right' | 'left') => void
}) {
  return (
    <div
      className="dbg-row"
      role="row"
      aria-rowindex={index + 2}
      data-row-id={row.id}
      style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
    >
      {columns.map((c, i) => {
        const isEditing = editing?.fieldId === c.field.id
        return (
          <div
            key={c.field.id}
            role="gridcell"
            aria-colindex={i + 1}
            aria-selected={activeField === c.field.id}
            data-field-id={c.field.id}
            data-type={c.field.type}
            className={`dbg-cell${c.frozen ? ' is-frozen' : ''}${activeField === c.field.id ? ' is-active' : ''}${isEditing ? ' is-editing' : ''}`}
            style={{ width: c.width, left: c.frozen ? c.left : undefined }}
            onPointerDown={(e) => {
              if (e.button !== 0 || isEditing) return
              if ((e.target as HTMLElement).closest('a, button')) return
              onCellPointer(c.field.id, e)
            }}
          >
            {isEditing ? (
              <CellEditor field={c.field} initial={editing.initial} onDone={onFinishEdit} />
            ) : (
              <CellView
                field={c.field}
                value={cellOf(c.field, row)}
                wrap={c.wrap}
                readOnly={readOnly}
                onToggle={() => onToggle(c.field.id)}
              />
            )}
          </div>
        )
      })}
      <div className="dbg-fill" />
    </div>
  )
})
