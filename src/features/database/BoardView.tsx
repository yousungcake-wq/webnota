import { Pencil, Plus } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  asMedia,
  cellOf,
  defaultGroupField,
  groupCellValue,
  groupFieldOf,
  isEmptyCell,
  NO_VALUE,
  orderedFields,
  setCell,
  updateGroup,
  type FieldMeta,
  type QueryGroup,
  type RowSnapshot,
} from '@/core/model/database'
import { useImageSrc } from '@/features/files'
import { Button, EmptyState } from '@/ui'
import { CardBody } from './CardBody'
import { addStatusField } from './create'
import { GroupLabel } from './GroupLabel'
import { dt } from './i18n'
import type { LayoutProps } from './layoutProps'
import { RowSheet } from './RowSheet'
import { measuredLayout } from './rowLayout'
import { newRow } from './rowActions'
import type { DbSession } from './session'
import { useScrollBox } from './useScrollBox'
import './board.css'

/** Card geometry (px) — fixed line heights, so card heights are computed, not measured. */
const CARD = { pad: 22, title: 20, prop: 24, cover: 132, gap: 8 }

/**
 * Board layout (M5-03, spec/05 §5): one column per group of the view's group field,
 * scrolling sideways; cards inside a column are virtualized. A card shows its title, the
 * chosen properties (empty ones skipped) and an optional media cover.
 */
export default function BoardView({ session, state, title, readOnly }: LayoutProps) {
  const view = state.view
  const field = groupFieldOf(state.fields, view?.group)
  const fallback = field ? null : defaultGroupField(state.fields)
  // a board without a (valid) group field groups by the first select-like field
  useEffect(() => {
    if (!readOnly && view && fallback) updateGroup(state.docs, view.id, { fieldId: fallback.id })
  }, [readOnly, view, fallback, state.docs])
  const primary = state.fields.find((f) => f.id === state.meta.primaryFieldId)
  // cards show the view's visible properties, in view order (DB-K06)
  const cardFields = useMemo(
    () =>
      view
        ? orderedFields(state.fields, view).filter((f) => f.id !== primary?.id && view.fields[f.id]?.visible !== false)
        : [],
    [view, state.fields, primary],
  )
  const coverField = state.fields.find((f) => f.id === view?.board.coverFieldId && f.type === 'media') ?? null
  const [open, setOpen] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  if (!view) return null
  if (!field) {
    if (fallback) return null // grouping is being set
    return (
      <EmptyState
        title={dt('db.board.noGroupField')}
        description={dt('db.board.noGroupFieldHint')}
        action={
          readOnly ? undefined : (
            <Button
              onClick={() => {
                const id = addStatusField(state.docs)
                updateGroup(state.docs, view.id, { fieldId: id })
              }}
            >
              {dt('db.board.createStatus')}
            </Button>
          )
        }
      />
    )
  }
  const group = view.group!
  const columns = (state.result.groups ?? []).filter(
    (g) => !group.hidden.includes(g.key) && !(g.key === NO_VALUE && group.hideEmpty),
  )
  const addCard = (key: string) => {
    const id = newRow(state.docs, state.fields, view)
    const value = groupCellValue(field, key)
    if (value !== undefined) setCell(state.docs, id, field.id, value)
    setEditing(id)
  }
  return (
    <div className="dbk" role="list" aria-label={dt('db.board.label', { title })}>
      {columns.map((g) => (
        <BoardColumn
          key={g.key}
          group={g}
          field={field}
          session={session}
          rowsVersion={state.rowsVersion}
          primary={primary}
          cardFields={cardFields}
          coverField={coverField}
          readOnly={readOnly}
          editing={editing}
          onOpen={setOpen}
          onEdit={setEditing}
          onAdd={addCard}
          onRename={(rowId, text) => {
            if (primary && text !== null) setCell(state.docs, rowId, primary.id, text)
            setEditing(null)
          }}
        />
      ))}
      {open && (
        <RowSheet session={session} state={state} rowId={open} readOnly={readOnly} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}

function cardHeight(row: RowSnapshot, fields: FieldMeta[], cover: FieldMeta | null) {
  let h = CARD.pad + CARD.title
  for (const f of fields) if (!isEmptyCell(f, cellOf(f, row))) h += CARD.prop
  if (cover && asMedia(cellOf(cover, row)).some((m) => m.mime.startsWith('image/'))) h += CARD.cover
  return h + CARD.gap
}

function BoardColumn({
  group,
  field,
  session,
  rowsVersion,
  primary,
  cardFields,
  coverField,
  readOnly,
  editing,
  onOpen,
  onEdit,
  onAdd,
  onRename,
}: {
  group: QueryGroup
  field: FieldMeta
  session: DbSession
  rowsVersion: number
  primary: FieldMeta | undefined
  cardFields: FieldMeta[]
  coverField: FieldMeta | null
  readOnly: boolean
  editing: string | null
  onOpen: (id: string) => void
  onEdit: (id: string | null) => void
  onAdd: (key: string) => void
  onRename: (rowId: string, text: string | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const box = useScrollBox(ref)
  const ids = group.rowIds
  // heights depend on cell values: recomputed when rows change (rowsVersion)
  const layout = useMemo(() => {
    const heights = new Map<string, number>()
    for (const id of ids) {
      const row = session.row(id)
      if (row) heights.set(id, cardHeight(row, cardFields, coverField))
    }
    return measuredLayout(ids, heights, CARD.pad + CARD.title + CARD.gap)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rowsVersion invalidates row snapshots
  }, [ids, cardFields, coverField, session, rowsVersion])
  // a card being titled (just added) is scrolled into view
  const editIndex = editing ? ids.indexOf(editing) : -1
  useEffect(() => {
    const el = ref.current
    if (!el || editIndex < 0) return
    const top = layout.top(editIndex)
    const bottom = top + layout.height(editIndex)
    if (top < el.scrollTop || bottom > el.scrollTop + el.clientHeight)
      el.scrollTop = Math.max(0, bottom - el.clientHeight)
  }, [editIndex, layout])
  const start = ids.length ? Math.max(0, layout.indexAt(box.top) - 3) : 0
  const end = Math.min(ids.length, layout.indexAt(box.top + box.height) + 4)
  return (
    <section className="dbk-col" role="listitem" data-group={group.key} aria-label={undefined}>
      <header className="dbk-head">
        <GroupLabel field={field} groupKey={group.key} />
        <span className="dbk-count">{ids.length}</span>
        {!readOnly && (
          <button
            type="button"
            className="db-icon-btn dbk-add-top"
            aria-label={dt('db.board.addCard')}
            title={dt('db.board.addCard')}
            onClick={() => onAdd(group.key)}
          >
            <Plus size={14} aria-hidden />
          </button>
        )}
      </header>
      <div ref={ref} className="dbk-cards">
        <div style={{ height: layout.total, position: 'relative' }}>
          {ids.slice(start, end).map((id, k) => {
            const row = session.row(id)
            if (!row) return null
            const i = start + k
            return (
              <BoardCard
                key={id}
                row={row}
                top={layout.top(i)}
                height={layout.height(i) - CARD.gap}
                primary={primary}
                fields={cardFields}
                cover={coverField}
                readOnly={readOnly}
                editing={editing === id}
                onOpen={onOpen}
                onEdit={onEdit}
                onRename={onRename}
              />
            )
          })}
        </div>
      </div>
      {!readOnly && (
        <button type="button" className="dbk-new" onClick={() => onAdd(group.key)}>
          <Plus size={14} aria-hidden />
          {dt('db.board.new')}
        </button>
      )}
    </section>
  )
}

const BoardCard = memo(function BoardCard({
  row,
  top,
  height,
  primary,
  fields,
  cover,
  readOnly,
  editing,
  onOpen,
  onEdit,
  onRename,
}: {
  row: RowSnapshot
  top: number
  height: number
  primary: FieldMeta | undefined
  fields: FieldMeta[]
  cover: FieldMeta | null
  readOnly: boolean
  editing: boolean
  onOpen: (id: string) => void
  onEdit: (id: string | null) => void
  onRename: (rowId: string, text: string | null) => void
}) {
  const image = cover ? asMedia(cellOf(cover, row)).find((m) => m.mime.startsWith('image/')) : undefined
  const title = primary ? String(cellOf(primary, row) ?? '') : ''
  return (
    <div className="dbk-card" data-row-id={row.id} style={{ top, height }}>
      {editing ? (
        <div className="dbk-card-body">
          {image && <CardCover fileId={image.fileId} />}
          <input
            className="dbk-title-input"
            autoFocus
            defaultValue={title}
            aria-label={dt('db.board.cardTitle')}
            placeholder={dt('db.row.untitled')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) onRename(row.id, e.currentTarget.value)
              else if (e.key === 'Escape') onRename(row.id, null)
            }}
            onBlur={(e) => onRename(row.id, e.currentTarget.value)}
          />
        </div>
      ) : (
        <button type="button" className="dbk-card-body" onClick={() => onOpen(row.id)}>
          {image && <CardCover fileId={image.fileId} />}
          <CardBody row={row} primary={primary} fields={fields} labels={false} />
        </button>
      )}
      {!readOnly && !editing && (
        <button
          type="button"
          className="db-icon-btn dbk-edit"
          aria-label={dt('db.board.editTitle')}
          title={dt('db.board.editTitle')}
          onClick={() => onEdit(row.id)}
        >
          <Pencil size={13} aria-hidden />
        </button>
      )}
    </div>
  )
})

function CardCover({ fileId }: { fileId: string }) {
  const src = useImageSrc(fileId)
  return src ? <img className="dbk-cover" src={src} alt="" /> : <span className="dbk-cover is-loading" aria-hidden />
}
