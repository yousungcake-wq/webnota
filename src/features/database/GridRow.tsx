import { GripVertical, Maximize2, Plus } from 'lucide-react'
import { memo } from 'react'
import { cellOf, type RowSnapshot } from '@/core/model/database'
import { CellEditor } from './CellEditor'
import { CellView } from './CellView'
import { dt } from './i18n'
import { GUTTER, renderedColumns, type Column } from './gridColumns'

export interface GridPos {
  rowId: string
  fieldId: string
}

/** Row callbacks, one stable object for every row so memoized rows skip re-rendering. */
export interface GridRowActions {
  onCellPointer: (rowId: string, fieldId: string, e: React.PointerEvent) => void
  onToggle: (rowId: string, fieldId: string) => void
  onFinishEdit: (text: string | null, move?: 'down' | 'right' | 'left') => void
  /** Gutter "+" (insert below), handle press (menu / drag / select), primary-cell "open". */
  onRowAction: (rowId: string, action: 'insert' | 'handle' | 'open', e: React.PointerEvent | React.MouseEvent) => void
}

/** One grid row: frozen cells, a spacer, the visible window of cells, a spacer (DB-G01). */
export const GridRow = memo(function GridRow({
  row,
  index,
  top,
  height,
  columns,
  colFrom,
  colTo,
  readOnly,
  activeField,
  rangeCols,
  editing,
  actions,
  selected,
  primaryId,
}: {
  row: RowSnapshot
  index: number
  top: number
  /** null: grows with wrapped content (measured by the grid, DB-G08). */
  height: number | null
  columns: Column[]
  colFrom: number
  colTo: number
  readOnly: boolean
  activeField: string | null
  /** "c0:c1" when this row is inside a range selection (DB-G04). */
  rangeCols: string | null
  editing: (GridPos & { initial: string }) | null
  actions: GridRowActions
  selected: boolean
  primaryId: string
}) {
  const { onCellPointer, onToggle, onFinishEdit, onRowAction } = actions
  const { frozen, shown, before, after } = renderedColumns(columns, { from: colFrom, to: colTo })
  const [c0, c1] = rangeCols ? rangeCols.split(':').map(Number) : [-1, -1]
  const cell = (c: Column) => {
    const isEditing = editing?.fieldId === c.field.id
    const active = activeField === c.field.id
    const ci = columns.indexOf(c)
    const inRange = ci >= c0! && ci <= c1!
    return (
      <div
        key={c.field.id}
        role="gridcell"
        aria-colindex={columns.indexOf(c) + 1}
        aria-selected={active || inRange}
        data-field-id={c.field.id}
        data-type={c.field.type}
        className={`dbg-cell${c.frozen ? ' is-frozen' : ''}${active ? ' is-active' : ''}${isEditing ? ' is-editing' : ''}${c.wrap ? ' is-wrap' : ''}${inRange ? ' is-inrange' : ''}`}
        style={{ width: c.width, left: c.frozen ? c.left + GUTTER : undefined }}
        onPointerDown={(e) => {
          if (e.button !== 0 || isEditing) return
          if ((e.target as HTMLElement).closest('a, button, input')) return
          onCellPointer(row.id, c.field.id, e)
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
            onToggle={() => onToggle(row.id, c.field.id)}
          />
        )}
        {c.field.id === primaryId && !isEditing && (
          <button
            type="button"
            className="dbg-open"
            tabIndex={-1}
            aria-label={dt('db.row.open')}
            data-label={dt('db.row.open')}
            onClick={(e) => onRowAction(row.id, 'open', e)}
          >
            <Maximize2 size={12} aria-hidden />
          </button>
        )}
      </div>
    )
  }
  return (
    <div
      className={`dbg-row${height === null ? ' is-auto' : ''}${selected ? ' is-selected' : ''}`}
      role="row"
      aria-rowindex={index + 2}
      data-row-id={row.id}
      style={height === null ? { top } : { top, height }}
    >
      <div className="dbg-gutter" style={{ width: GUTTER }}>
        {!readOnly && (
          <>
            <button
              type="button"
              className="dbg-gbtn"
              tabIndex={-1}
              aria-label={dt('db.row.insertBelow')}
              title={dt('db.row.insertBelow')}
              onClick={(e) => onRowAction(row.id, 'insert', e)}
            >
              <Plus size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="dbg-gbtn is-grip"
              tabIndex={-1}
              aria-label={dt('db.row.menu')}
              title={dt('db.row.menu')}
              onPointerDown={(e) => onRowAction(row.id, 'handle', e)}
            >
              <GripVertical size={14} aria-hidden />
            </button>
          </>
        )}
      </div>
      {frozen.map(cell)}
      {before > 0 && <div className="dbg-spacer" style={{ width: before }} />}
      {shown.map(cell)}
      {after > 0 && <div className="dbg-spacer" style={{ width: after }} />}
      <div className="dbg-fill" />
    </div>
  )
})
