import { useMemo, useRef, useState } from 'react'
import { cellOf, readDbMeta, type FieldMeta } from '@/core/model/database'
import { CellView } from './CellView'
import { columnsOf } from './gridColumns'
import { dt } from './i18n'
import { RowSheet } from './RowSheet'
import { fixedLayout } from './rowLayout'
import type { DbSession, DbState } from './session'
import { useScrollBox } from './useScrollBox'

const CARD_HEIGHT = 116
const CARD_FIELDS = 3

/**
 * Phone "card list" (MB-30): one card per row with its title and the first few visible
 * properties; tap opens the row's properties. Fixed-height cards, virtualized.
 */
export function CardList({
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
  const ref = useRef<HTMLDivElement>(null)
  const box = useScrollBox(ref)
  const [open, setOpen] = useState<string | null>(null)
  const rowIds = state.result.rowIds
  const primary = state.meta.primaryFieldId || readDbMeta(state.docs).primaryFieldId
  const fields = useMemo(
    () =>
      columnsOf(state.fields, state.view)
        .map((c) => c.field)
        .filter((f) => f.id !== primary)
        .slice(0, CARD_FIELDS),
    [state.fields, state.view, primary],
  )
  const layout = fixedLayout(rowIds.length, CARD_HEIGHT)
  const start = rowIds.length ? Math.max(0, layout.indexAt(box.top) - 4) : 0
  const end = Math.min(rowIds.length, layout.indexAt(box.top + box.height) + 5)
  const primaryField = state.fields.find((f) => f.id === primary)
  return (
    <div ref={ref} className="db-cards" role="list" aria-label={dt('db.cards.label', { title })}>
      <div style={{ height: layout.total, position: 'relative' }}>
        {rowIds.slice(start, end).map((id, k) => {
          const row = session.row(id)
          if (!row) return null
          const name = primaryField ? String(cellOf(primaryField, row) ?? '') : ''
          return (
            <button
              key={id}
              type="button"
              role="listitem"
              className="db-card"
              style={{ top: layout.top(start + k), height: CARD_HEIGHT - 8 }}
              onClick={() => setOpen(id)}
            >
              <span className="db-card-title">{name || dt('db.row.untitled')}</span>
              {fields.map((f: FieldMeta) => (
                <span key={f.id} className="db-card-prop">
                  <span className="db-card-name">{f.name}</span>
                  <CellView field={f} value={cellOf(f, row)} wrap={false} readOnly onToggle={() => {}} />
                </span>
              ))}
            </button>
          )
        })}
      </div>
      {open && (
        <RowSheet session={session} state={state} rowId={open} readOnly={readOnly} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}
