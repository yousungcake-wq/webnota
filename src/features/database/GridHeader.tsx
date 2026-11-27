import { Plus } from 'lucide-react'
import { useState } from 'react'
import {
  addField,
  moveViewField,
  setViewField,
  type DbDocs,
  type FieldMeta,
  type FieldType,
  type ViewSettings,
} from '@/core/model/database'
import { useLayout } from '@/platform/layout'
import { Overlay } from '@/ui'
import { FieldMenu, TypeList, uniqueName } from './FieldMenu'
import { FIELD_TYPE_INFO } from './fieldTypes'
import { GUTTER, HEADER_HEIGHT, renderedColumns, type Column } from './gridColumns'
import { dt } from './i18n'

const MIN_WIDTH = 80
const MAX_WIDTH = 800

/**
 * Sticky header row (DB-G01): click a header for the field menu (DB-F02), drag it to move
 * the column, drag its right edge to resize (DB-F03), "+" at the end adds a field (DB-F01).
 */
export function GridHeader({
  columns,
  colRange,
  docs,
  fields,
  view,
  primaryId,
  readOnly,
  height = HEADER_HEIGHT,
}: {
  height?: number
  columns: Column[]
  colRange: { from: number; to: number }
  docs: DbDocs
  fields: FieldMeta[]
  view: ViewSettings | null
  primaryId: string
  readOnly: boolean
}) {
  const phone = useLayout().layout === 'phone'
  const [menu, setMenu] = useState<{ fieldId: string; anchor: HTMLElement | null } | null>(null)
  const [adding, setAdding] = useState<HTMLElement | null>(null)
  const [resize, setResize] = useState<{ fieldId: string; width: number } | null>(null)
  const [drag, setDrag] = useState<{ fieldId: string; drop: number; x: number } | null>(null)
  const widthOf = (c: Column) => (resize?.fieldId === c.field.id ? resize.width : c.width)
  const { frozen, shown, before, after } = renderedColumns(columns, colRange)
  const totalWidth = GUTTER + columns.reduce((n, c) => n + widthOf(c), 0)

  const startResize = (c: Column, e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const x0 = e.clientX
    let width = c.width
    const onMove = (ev: PointerEvent) => {
      width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, c.width + ev.clientX - x0))
      setResize({ fieldId: c.field.id, width })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setResize(null)
      if (view && width !== c.width) setViewField(docs, view.id, c.field.id, { width: Math.round(width) })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /** Press: menu on release; move: drag the column to a new place (DB-F03). */
  const startPress = (c: Column, e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    const target = e.currentTarget
    const x0 = e.clientX
    let dragging = false
    let drop = columns.indexOf(c)
    const onMove = (ev: PointerEvent) => {
      if (readOnly || !view) return
      if (!dragging && Math.abs(ev.clientX - x0) < 6) return
      dragging = true
      const row = target.closest('.dbg-header')!.getBoundingClientRect()
      const x = ev.clientX - row.left - GUTTER
      drop = columns.findIndex((col) => x < col.left + col.width / 2)
      if (drop < 0) drop = columns.length
      const at = drop < columns.length ? columns[drop]!.left : columns.reduce((n, col) => n + col.width, 0)
      setDrag({ fieldId: c.field.id, drop, x: at + GUTTER })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      setDrag(null)
      if (!dragging) return setMenu({ fieldId: c.field.id, anchor: target })
      const from = columns.indexOf(c)
      if (!view || drop === from || drop === from + 1) return
      // index among all ordered fields of the view: position of the column now at `drop`
      const ordered = columns.map((x) => x.field.id).filter((id) => id !== c.field.id)
      const target2 = drop > from ? drop - 1 : drop
      const beforeId = ordered[target2]
      const allIds = Object.entries(view.fields)
        .sort((a, b) => (a[1].order < b[1].order ? -1 : a[1].order > b[1].order ? 1 : 0))
        .map(([id]) => id)
        .filter((id) => id !== c.field.id)
      moveViewField(docs, view.id, c.field.id, beforeId ? allIds.indexOf(beforeId) : allIds.length)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const addOfType = (type: FieldType) => {
    setAdding(null)
    if (!view) return
    const id = addField(docs, { name: uniqueName(dt(FIELD_TYPE_INFO[type].label), fields), type, viewId: view.id })
    // open the new field's menu to name it (the header renders on the next frame)
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`.dbg-hcell[data-field-id="${CSS.escape(id)}"]`)
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      setMenu({ fieldId: id, anchor: el })
    })
  }

  const cell = (c: Column) => {
    const Icon = FIELD_TYPE_INFO[c.field.type]?.icon
    return (
      <div
        key={c.field.id}
        className={`dbg-hcell${c.frozen ? ' is-frozen' : ''}${drag?.fieldId === c.field.id ? ' is-dragging' : ''}`}
        role="columnheader"
        aria-colindex={columns.indexOf(c) + 1}
        data-field-id={c.field.id}
        style={{ width: widthOf(c), left: c.frozen ? c.left + GUTTER : undefined }}
      >
        <button
          type="button"
          className="dbg-hbtn"
          aria-haspopup="dialog"
          aria-label={dt('db.field.menu', { name: c.field.name })}
          disabled={readOnly}
          onPointerDown={(e) => startPress(c, e)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setMenu({ fieldId: c.field.id, anchor: e.currentTarget })
            }
          }}
        >
          {Icon && <Icon size={14} aria-hidden className="dbg-hicon" />}
          <span className="dbg-hname">{c.field.name}</span>
        </button>
        {!readOnly && (
          <span
            className="dbg-resize"
            role="separator"
            aria-orientation="vertical"
            aria-label={dt('db.field.resize')}
            onPointerDown={(e) => startResize(c, e)}
          />
        )}
      </div>
    )
  }

  const menuField = menu && fields.find((f) => f.id === menu.fieldId)
  return (
    <div className="dbg-header" role="row" aria-rowindex={1} style={{ width: totalWidth, height }}>
      <div className="dbg-gutter" style={{ width: GUTTER }} />
      {frozen.map(cell)}
      {before > 0 && <div className="dbg-spacer" style={{ width: before }} />}
      {shown.map(cell)}
      {after > 0 && <div className="dbg-spacer" style={{ width: after }} />}
      {!readOnly && (
        <button
          type="button"
          className="dbg-hadd"
          aria-label={dt('db.field.add')}
          title={dt('db.field.add')}
          onClick={(e) => setAdding(e.currentTarget)}
        >
          <Plus size={16} aria-hidden />
        </button>
      )}
      <div className="dbg-fill" />
      {drag && <div className="dbg-coldrop" style={{ left: drag.x }} aria-hidden />}
      {adding && (
        <Overlay anchor={adding} title={dt('db.field.add')} sheet={phone} onClose={() => setAdding(null)}>
          <div className="db-pop">
            <TypeList onPick={addOfType} />
          </div>
        </Overlay>
      )}
      {menuField && view && (
        <FieldMenu
          docs={docs}
          field={menuField}
          fields={fields}
          view={view}
          primaryId={primaryId}
          anchor={menu.anchor?.isConnected ? menu.anchor : null}
          index={Math.max(
            0,
            columns.findIndex((c) => c.field.id === menuField.id),
          )}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}
