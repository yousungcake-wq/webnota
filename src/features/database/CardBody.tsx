import { memo } from 'react'
import { cellOf, isEmptyCell, type FieldMeta, type RowSnapshot } from '@/core/model/database'
import { CellView } from './CellView'
import { dt } from './i18n'

const noop = () => {}

/**
 * The inside of a row card (M5-00): title (primary field) and a few properties, shared by
 * the phone card list, Board cards and Calendar events. `labels` shows field names (card
 * list); Board and Calendar show values only and skip empty ones, like AppFlowy.
 */
export const CardBody = memo(function CardBody({
  row,
  primary,
  fields,
  labels,
}: {
  row: RowSnapshot
  primary: FieldMeta | undefined
  /** Properties to show (not the primary field); keep the array stable across renders. */
  fields: FieldMeta[]
  labels: boolean
}) {
  const name = primary ? String(cellOf(primary, row) ?? '') : ''
  return (
    <>
      <span className={`db-card-title${name ? '' : ' is-empty'}`}>{name || dt('db.row.untitled')}</span>
      {fields.map((f) => {
        const value = cellOf(f, row)
        if (!labels && f.type !== 'rollup' && isEmptyCell(f, value)) return null
        return (
          <span key={f.id} className="db-card-prop" data-type={f.type}>
            {labels && <span className="db-card-name">{f.name}</span>}
            <CellView field={f} value={value} wrap={false} readOnly onToggle={noop} row={row} />
          </span>
        )
      })}
    </>
  )
})
