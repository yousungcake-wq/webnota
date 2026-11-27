import { ChevronDown, ChevronRight, GripVertical, Image as ImageIcon, Plus, Smile, Trash2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type * as Y from 'yjs'
import { rowDocName } from '@/core/docs/database'
import { openDoc, retainDoc } from '@/core/docs/registry'
import {
  addField,
  cellOf,
  moveViewField,
  orderedFields,
  setCell,
  updateRow,
  type CoverValue,
  type FieldMeta,
  type FieldType,
  type RowSnapshot,
} from '@/core/model/database'
import type { IconValue } from '@/core/model/views'
import { useLayout } from '@/platform/layout'
import { loadEditor } from '@/features/editor'
import { loadEmojiPicker } from '@/features/emoji'
import { useImageSrc } from '@/features/files'
import { loadCoverPicker, ViewIcon } from '@/features/page'
import { Menu, Overlay, Skeleton, type MenuEntry } from '@/ui'
import { FIELD_TYPE_INFO } from './fieldTypes'
import { uniqueName } from './FieldMenu'
import { dt } from './i18n'
import { RowProperty } from './RowProperty'
import type { DbSession, DbState } from './session'
import { useReorder } from './useReorder'
import './rowpage.css'

const Editor = lazy(() => loadEditor().then((m) => ({ default: m.Editor })))
const EmojiPicker = lazy(loadEmojiPicker)
const CoverPicker = lazy(loadCoverPicker)

/**
 * Row page (M5-08, spec/05 §7 DB-R01–R03): icon, cover and title (the primary field),
 * every property (hidden ones folded under "N hidden", drag to reorder — the view's field
 * order), "add property", and a full editor body in `row/<db>/<row>` — opened only here,
 * and marked on the row (`hasDoc`) once it has content, so untouched rows never get a file.
 */
export function RowPage({
  session,
  state,
  rowId,
  readOnly,
}: {
  session: DbSession
  state: DbState
  rowId: string
  readOnly: boolean
}) {
  const row = session.row(rowId)
  const view = state.view
  const primary = state.fields.find((f) => f.id === state.meta.primaryFieldId)
  const [showHidden, setShowHidden] = useState(false)
  const [picker, setPicker] = useState<{ kind: 'icon' | 'cover' | 'add'; anchor: HTMLElement } | null>(null)
  const phone = useLayout().layout === 'phone'
  const fields = view ? orderedFields(state.fields, view).filter((f) => f.id !== primary?.id) : []
  const shown = fields.filter((f) => view?.fields[f.id]?.visible !== false)
  const hidden = fields.filter((f) => view?.fields[f.id]?.visible === false)
  const reorder = useReorder((from, to) => {
    if (!view) return
    // positions among the shown properties → the view's field order (primary stays first)
    const target = shown[to]!
    moveViewField(state.docs, view.id, shown[from]!.id, orderedFields(state.fields, view).indexOf(target))
  })
  if (!row) return <p className="db-empty">{dt('db.row.gone')}</p>
  const setIcon = (icon: IconValue | null) => updateRow(state.docs, row.id, { icon })
  const setCover = (cover: CoverValue | null) => updateRow(state.docs, row.id, { cover })
  const addProperty = (type: FieldType) =>
    addField(state.docs, { name: uniqueName(dt(FIELD_TYPE_INFO[type].label), state.fields), type, viewId: view?.id })
  const types = (Object.keys(FIELD_TYPE_INFO) as FieldType[]).filter((t) => FIELD_TYPE_INFO[t].available)
  const addMenu: MenuEntry[] = types.map((type) => ({
    label: dt(FIELD_TYPE_INFO[type].label),
    icon: FIELD_TYPE_INFO[type].icon,
    onSelect: () => addProperty(type),
  }))

  return (
    <article className="db-rowpage" data-row-id={row.id}>
      {row.cover && <RowCover cover={row.cover} />}
      <div className="db-rowpage-head">
        {row.icon && (
          <button
            type="button"
            className="db-rowpage-icon"
            aria-label={dt('db.rowpage.icon')}
            disabled={readOnly}
            onClick={(e) => setPicker({ kind: 'icon', anchor: e.currentTarget })}
          >
            <ViewIcon icon={row.icon} size={40} />
          </button>
        )}
        {!readOnly && (
          <div className="db-rowpage-actions">
            {!row.icon && (
              <button
                type="button"
                className="db-option-create"
                onClick={(e) => setPicker({ kind: 'icon', anchor: e.currentTarget })}
              >
                <Smile size={14} aria-hidden /> {dt('db.rowpage.addIcon')}
              </button>
            )}
            <button
              type="button"
              className="db-option-create"
              onClick={(e) => setPicker({ kind: 'cover', anchor: e.currentTarget })}
            >
              <ImageIcon size={14} aria-hidden /> {row.cover ? dt('db.rowpage.changeCover') : dt('db.rowpage.addCover')}
            </button>
            {row.cover && (
              <button type="button" className="db-option-create" onClick={() => setCover(null)}>
                <Trash2 size={14} aria-hidden /> {dt('db.rowpage.removeCover')}
              </button>
            )}
          </div>
        )}
        <RowTitle
          key={row.id}
          row={row}
          primary={primary}
          readOnly={readOnly}
          onChange={(text) => primary && setCell(state.docs, row.id, primary.id, text)}
        />
      </div>

      <div className="db-rowsheet db-rowpage-props">
        {shown.map((f, i) => (
          <div key={f.id} className="db-rowpage-prop" data-reorder-item style={reorder.style(i)}>
            {!readOnly && !phone && (
              <span className="db-grip" aria-label={dt('db.select.drag')} {...reorder.handle(i)}>
                <GripVertical size={14} aria-hidden />
              </span>
            )}
            <RowProperty state={state} field={f} row={row} readOnly={readOnly} />
          </div>
        ))}
        {hidden.length > 0 && (
          <button
            type="button"
            className="db-option-create db-rowpage-hidden"
            aria-expanded={showHidden}
            onClick={() => setShowHidden(!showHidden)}
          >
            {showHidden ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
            {dt('db.rowpage.hidden', { count: hidden.length })}
          </button>
        )}
        {showHidden &&
          hidden.map((f) => (
            <div key={f.id} className="db-rowpage-prop is-hidden">
              <RowProperty state={state} field={f} row={row} readOnly={readOnly} />
            </div>
          ))}
        {!readOnly && (
          <button
            type="button"
            className="db-option-create"
            onClick={(e) => setPicker({ kind: 'add', anchor: e.currentTarget })}
          >
            <Plus size={14} aria-hidden /> {dt('db.rowpage.addProperty')}
          </button>
        )}
      </div>

      <RowBody
        dbId={state.dbId}
        row={row}
        readOnly={readOnly}
        onContent={() => !row.hasDoc && updateRow(state.docs, row.id, { hasDoc: true })}
      />

      {picker?.kind === 'add' && (
        <Menu
          anchor={picker.anchor}
          title={dt('db.rowpage.addProperty')}
          items={addMenu}
          onClose={() => setPicker(null)}
        />
      )}
      {picker?.kind === 'icon' && (
        <Overlay anchor={picker.anchor} title={dt('db.rowpage.icon')} sheet={phone} onClose={() => setPicker(null)}>
          <Suspense fallback={<div className="emoji-loading" />}>
            <EmojiPicker
              current={row.icon}
              onPick={(icon) => {
                setIcon(icon)
                setPicker(null)
              }}
            />
          </Suspense>
        </Overlay>
      )}
      {picker?.kind === 'cover' && (
        <Suspense fallback={null}>
          <CoverPicker
            value={row.cover}
            onChange={(c) => setCover(c)}
            anchor={picker.anchor}
            onClose={() => setPicker(null)}
          />
        </Suspense>
      )}
    </article>
  )
}

function RowCover({ cover }: { cover: CoverValue }) {
  const file = useImageSrc(cover.type === 'file' ? cover.value : null)
  const src = cover.type === 'file' ? file : cover.type === 'url' ? cover.value : null
  // same tokens as page covers (features/page pageMeta)
  const bg =
    cover.type === 'color'
      ? `var(--c-${cover.value}-text)`
      : cover.type === 'gradient'
        ? `var(--cover-${cover.value})`
        : undefined
  return (
    <div className="db-rowpage-cover" style={{ background: bg }}>
      {src && <img src={src} alt="" style={{ objectPosition: `center ${cover.offsetY ?? 50}%` }} />}
    </div>
  )
}

/** The primary field as the page title; written as you type (IME: after composition). */
function RowTitle({
  row,
  primary,
  readOnly,
  onChange,
}: {
  row: RowSnapshot
  primary: FieldMeta | undefined
  readOnly: boolean
  onChange: (text: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const value = primary ? String(cellOf(primary, row) ?? '') : ''
  // follow changes from elsewhere unless the field is being edited
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.value !== value) el.value = value
  }, [value])
  return (
    <textarea
      ref={ref}
      className="db-rowpage-title"
      rows={1}
      defaultValue={value}
      readOnly={readOnly}
      aria-label={primary?.name ?? dt('db.row.untitled')}
      placeholder={dt('db.row.untitled')}
      onInput={(e) => {
        if (!(e.nativeEvent as InputEvent).isComposing) onChange(e.currentTarget.value.replace(/\n/g, ' '))
      }}
      onCompositionEnd={(e) => onChange(e.currentTarget.value.replace(/\n/g, ' '))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.preventDefault()
      }}
    />
  )
}

/** The row's document body (DB-R03), loaded and retained while the page is open. */
function RowBody({
  dbId,
  row,
  readOnly,
  onContent,
}: {
  dbId: string
  row: RowSnapshot
  readOnly: boolean
  onContent: () => void
}) {
  const [doc, setDoc] = useState<Y.Doc | null>(null)
  const content = useRef(onContent)
  useEffect(() => {
    content.current = onContent
  })
  useEffect(() => {
    const name = rowDocName(dbId, row.id)
    const release = retainDoc(name)
    let off = () => {}
    let alive = true
    void openDoc(name).then((d) => {
      if (!alive) return
      setDoc(d)
      const check = () => {
        if (d.getXmlFragment('default').length > 0) content.current()
      }
      d.on('update', check)
      off = () => d.off('update', check)
    })
    return () => {
      alive = false
      off()
      release()
    }
  }, [dbId, row.id])
  return (
    <div className="db-rowpage-body">
      {doc ? (
        <Suspense fallback={<Skeleton className="editor-loading" />}>
          <Editor key={row.id} doc={doc} locked={readOnly} />
        </Suspense>
      ) : (
        <Skeleton className="editor-loading" />
      )}
    </div>
  )
}
