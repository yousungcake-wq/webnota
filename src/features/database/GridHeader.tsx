import { FIELD_TYPE_INFO } from './fieldTypes'
import { HEADER_HEIGHT, renderedColumns, type Column } from './gridColumns'

/** Sticky header row (DB-G01). Field menus, resizing and dragging arrive with M4-11. */
export function GridHeader({ columns, colRange }: { columns: Column[]; colRange: { from: number; to: number } }) {
  const { frozen, shown, before, after } = renderedColumns(columns, colRange)
  const totalWidth = columns.reduce((n, c) => n + c.width, 0)
  const cell = (c: Column) => {
    const Icon = FIELD_TYPE_INFO[c.field.type]?.icon
    return (
      <div
        key={c.field.id}
        className={`dbg-hcell${c.frozen ? ' is-frozen' : ''}`}
        role="columnheader"
        aria-colindex={columns.indexOf(c) + 1}
        data-field-id={c.field.id}
        style={{ width: c.width, left: c.frozen ? c.left : undefined }}
      >
        {Icon && <Icon size={14} aria-hidden className="dbg-hicon" />}
        <span className="dbg-hname">{c.field.name}</span>
      </div>
    )
  }
  return (
    <div className="dbg-header" role="row" aria-rowindex={1} style={{ width: totalWidth, height: HEADER_HEIGHT }}>
      {frozen.map(cell)}
      {before > 0 && <div className="dbg-spacer" style={{ width: before }} />}
      {shown.map(cell)}
      {after > 0 && <div className="dbg-spacer" style={{ width: after }} />}
      <div className="dbg-fill" />
    </div>
  )
}
