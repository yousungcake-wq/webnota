import { cellOf, type DbDocs, type FieldMeta, type RowSnapshot } from '@/core/model/database'
import { useLayout } from '@/platform/layout'
import { Overlay } from '@/ui'
import { ChecklistEditor } from './ChecklistEditor'
import { DateEditor } from './DateEditor'
import { MediaEditor } from './MediaEditor'
import { RelationEditor } from './RelationEditor'
import { SelectEditor } from './SelectEditor'

/** Field types edited in a popover (desktop) / bottom sheet (phone). */
export const POPOVER_EDITED = new Set(['select', 'multiSelect', 'date', 'checklist', 'media', 'relation'])

/** The editor of one popover-edited cell, anchored at the cell (spec/05 §3.2). */
export function CellPopover({
  docs,
  field,
  row,
  anchor,
  readOnly,
  onClose,
}: {
  docs: DbDocs
  field: FieldMeta
  row: RowSnapshot
  anchor: HTMLElement | null
  readOnly: boolean
  onClose: () => void
}) {
  const phone = useLayout().layout === 'phone'
  const props = { docs, field, rowId: row.id, value: cellOf(field, row), readOnly }
  return (
    <Overlay anchor={anchor} title={field.name} sheet={phone} onClose={onClose}>
      <div className="db-pop">
        {field.type === 'date' ? (
          <DateEditor {...props} />
        ) : field.type === 'media' ? (
          <MediaEditor {...props} />
        ) : field.type === 'relation' ? (
          <RelationEditor {...props} />
        ) : field.type === 'checklist' ? (
          <ChecklistEditor {...props} />
        ) : (
          <SelectEditor {...props} onClose={onClose} />
        )}
      </div>
    </Overlay>
  )
}
