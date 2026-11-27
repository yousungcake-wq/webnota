import { memo } from 'react'
import { cellOf, type RowSnapshot } from '@/core/model/database'
import { CellEditor } from './CellEditor'
import { CellView } from './CellView'
import { renderedColumns, type Column } from './gridColumns'

export interface GridPos {
  rowId: string
  fieldId: string
}

/** One grid row: frozen cells, a spacer, the visible window of cells, a spacer (DB-G01). */
export const GridRow = memo(function GridRow({
  row,
  index,
  top,
  height,
  columns,
  colRange,
  readOnly,
  activeField,
  editing,
  onCellPointer,
  onToggle,
  onFinishEdit,
}: {
  row: RowSnapshot
  index: number
  top: number
  /** null: grows with wrapped content (measured by the grid, DB-G08). */
  height: number | null
  columns: Column[]
  colRange: { from: number; to: number }
  readOnly: boolean
  activeField: string | null
  editing: (GridPos & { initial: string }) | null
  onCellPointer: (rowId: string, fieldId: string, e: React.PointerEvent) => void
  onToggle: (rowId: string, fieldId: string) => void
  onFinishEdit: (text: string | null, move?: 'down' | 'right' | 'left') => void
}) {
  const { frozen, shown, before, after } = renderedColumns(columns, colRange)
  const cell = (c: Column) => {
    const isEditing = editing?.fieldId === c.field.id
    const active = activeField === c.field.id
    return (
      <div
        key={c.field.id}
        role="gridcell"
        aria-colindex={columns.indexOf(c) + 1}
        aria-selected={active}
        data-field-id={c.field.id}
        data-type={c.field.type}
        className={`dbg-cell${c.frozen ? ' is-frozen' : ''}${active ? ' is-active' : ''}${isEditing ? ' is-editing' : ''}${c.wrap ? ' is-wrap' : ''}`}
        style={{ width: c.width, left: c.frozen ? c.left : undefined }}
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
      </div>
    )
  }
  return (
    <div
      className={`dbg-row${height === null ? ' is-auto' : ''}`}
      role="row"
      aria-rowindex={index + 2}
      data-row-id={row.id}
      style={height === null ? { top } : { top, height }}
    >
      {frozen.map(cell)}
      {before > 0 && <div className="dbg-spacer" style={{ width: before }} />}
      {shown.map(cell)}
      {after > 0 && <div className="dbg-spacer" style={{ width: after }} />}
      <div className="dbg-fill" />
    </div>
  )
})
