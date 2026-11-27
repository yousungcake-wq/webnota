import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Copy, Maximize2, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import {
  cellOf,
  duplicateRow,
  moveRow,
  prefillFromFilter,
  readDbMeta,
  setCell,
  type FieldMeta,
} from '@/core/model/database'
import { Button, Menu, toast } from '@/ui'
import type { DbSession, DbState } from './session'
import { dt } from './i18n'
import { CellPopover, POPOVER_EDITED } from './CellPopover'
import { editText, parseEdit, TEXT_EDITED } from './cellEdit'
import { columnsOf, GUTTER, HEADER_HEIGHT, ROW_HEIGHT, TOUCH_ROW_HEIGHT } from './gridColumns'
import { useLayout } from '@/platform/layout'
import { Sheet } from '@/ui'
import { CellEditor } from './CellEditor'
import { deleteRowsWithUndo, newRow } from './rowActions'
import { clearRect, copyRect, pasteTSV, rectOf } from './gridClipboard'
import { RowSheet } from './RowSheet'
import { CalcRow } from './CalcRow'
import { GridHeader } from './GridHeader'
import { GridRow, type GridPos as Pos, type GridRowActions } from './GridRow'
import { fixedLayout, measuredLayout, visibleColumns } from './rowLayout'
import { useScrollBox } from './useScrollBox'
import './grid.css'

const READ_ONLY_TYPES = new Set(['createdTime', 'updatedTime', 'rollup'])
const OVERSCAN_ROWS = 8
/** Widest a frozen column may be on a phone. */
const PHONE_FROZEN_MAX = 140

/** Grid layout (DB-G01, DB-G08): virtual rows and columns, sticky header, frozen columns, auto row height. */
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
  const { layout: screen, isTouch } = useLayout()
  const phone = screen === 'phone'
  // 44px touch targets on touch screens (spec/12), 36px rows with a mouse
  const rowH = isTouch ? TOUCH_ROW_HEIGHT : ROW_HEIGHT
  const headerH = isTouch ? TOUCH_ROW_HEIGHT : HEADER_HEIGHT
  const columns = useMemo(
    () => columnsOf(state.fields, state.view, phone ? PHONE_FROZEN_MAX : Infinity),
    [state.fields, state.view, phone],
  )
  const rowIds = state.result.rowIds
  const scrollRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const box = useScrollBox(scrollRef)
  const [active, setActive] = useState<Pos | null>(null)
  // one stable callbacks object for memoized rows; it calls the handlers of the last render
  const latest = useRef<GridRowActions | null>(null)
  const [rowActions] = useState<GridRowActions>(() => ({
    onCellPointer: (...a) => latest.current!.onCellPointer(...a),
    onToggle: (...a) => latest.current!.onToggle(...a),
    onFinishEdit: (...a) => latest.current!.onFinishEdit(...a),
    onRowAction: (...a) => latest.current!.onRowAction(...a),
  }))
  /** Range selection (DB-G04): from `anchor` to `active`. */
  const [anchor, setAnchor] = useState<Pos | null>(null)
  const [editing, setEditing] = useState<(Pos & { initial: string }) | null>(null)
  const [popover, setPopover] = useState<Pos | null>(null)
  const totalWidth = GUTTER + columns.reduce((n, c) => n + c.width, 0)
  const docs = state.docs
  const primaryId = state.meta.primaryFieldId || readDbMeta(docs).primaryFieldId
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [rowMenu, setRowMenu] = useState<{ rowId: string; anchor: HTMLElement } | null>(null)
  const [sheetRow, setSheetRow] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ rowId: string; drop: number } | null>(null)

  // DB-G08: wrapped columns make rows grow; their heights are measured after render.
  const autoHeight = columns.some((c) => c.wrap)
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(new Map())
  const layout = useMemo(
    () => (autoHeight ? measuredLayout(rowIds, heights, rowH) : fixedLayout(rowIds.length, rowH)),
    [autoHeight, rowIds, heights, rowH],
  )
  const viewTop = Math.max(0, box.top - headerH)
  const start = rowIds.length ? Math.max(0, layout.indexAt(viewTop) - OVERSCAN_ROWS) : 0
  const end = rowIds.length ? Math.min(rowIds.length, layout.indexAt(viewTop + box.height) + OVERSCAN_ROWS + 1) : 0
  const colRange = visibleColumns(columns, box.left, box.width - GUTTER)

  useLayoutEffect(() => {
    if (!autoHeight) return
    const measure = () => {
      const changed: [string, number][] = []
      bodyRef.current?.querySelectorAll<HTMLElement>('.dbg-row').forEach((el) => {
        const id = el.dataset.rowId!
        const h = el.offsetHeight
        if (heights.get(id) !== h) changed.push([id, h])
      })
      if (changed.length) setHeights((prev) => new Map([...prev, ...changed]))
    }
    measure()
  })

  const fieldById = useCallback((id: string) => columns.find((c) => c.field.id === id)?.field, [columns])
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
  const scrollIntoView = (pos: Pos) => {
    const el = scrollRef.current
    if (!el) return
    const i = rowIds.indexOf(pos.rowId)
    const top = headerH + layout.top(i)
    const h = layout.height(i)
    if (top < el.scrollTop + headerH) el.scrollTop = top - headerH
    else if (top + h > el.scrollTop + el.clientHeight) el.scrollTop = top + h - el.clientHeight
    const col = columns.find((c) => c.field.id === pos.fieldId)
    if (col && !col.frozen) {
      const frozenW = columns.filter((c) => c.frozen).reduce((n, c) => n + c.width, 0)
      if (col.left < el.scrollLeft + frozenW) el.scrollLeft = col.left - frozenW
      else if (col.left + col.width > el.scrollLeft + el.clientWidth)
        el.scrollLeft = col.left + col.width - el.clientWidth
    }
  }
  /** Moves the active cell by rows/columns (`to`: absolute index); `extend` grows the range. */
  const move = (dRow: number, dCol: number, extend = false, to?: { row?: number; col?: number }) => {
    if (!active) {
      if (rowIds[0] && columns[0]) setActive({ rowId: rowIds[0], fieldId: columns[0].field.id })
      return
    }
    const r = Math.max(0, Math.min(rowIds.length - 1, to?.row ?? rowIds.indexOf(active.rowId) + dRow))
    const c = Math.max(
      0,
      Math.min(columns.length - 1, to?.col ?? columns.findIndex((x) => x.field.id === active.fieldId) + dCol),
    )
    const next = { rowId: rowIds[r]!, fieldId: columns[c]!.field.id }
    if (extend) setAnchor((a) => a ?? active)
    else setAnchor(null)
    setActive(next)
    scrollIntoView(next)
  }
  const fieldIds = columns.map((c) => c.field.id)
  const rect = rectOf(anchor, active, rowIds, fieldIds)
  const multi = !!rect && (rect.r1 > rect.r0 || rect.c1 > rect.c0)
  const visibleFields = columns.map((c) => c.field)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editing || popover || e.nativeEvent.isComposing || e.target !== e.currentTarget) return
    const mod = e.metaKey || e.ctrlKey
    const keys: Record<string, () => void> = {
      ArrowDown: () => (mod ? move(0, 0, e.shiftKey, { row: rowIds.length - 1 }) : move(1, 0, e.shiftKey)),
      ArrowUp: () => (mod ? move(0, 0, e.shiftKey, { row: 0 }) : move(-1, 0, e.shiftKey)),
      ArrowRight: () => (mod ? move(0, 0, e.shiftKey, { col: columns.length - 1 }) : move(0, 1, e.shiftKey)),
      ArrowLeft: () => (mod ? move(0, 0, e.shiftKey, { col: 0 }) : move(0, -1, e.shiftKey)),
      Home: () => move(0, 0, e.shiftKey, mod ? { row: 0, col: 0 } : { col: 0 }),
      End: () =>
        move(0, 0, e.shiftKey, mod ? { row: rowIds.length - 1, col: columns.length - 1 } : { col: columns.length - 1 }),
      Tab: () => move(0, e.shiftKey ? -1 : 1),
      Enter: () => active && (startEdit(active) || toggle(active)),
      ' ': () => active && toggle(active),
      Escape: () => (selected.size ? setSelected(new Set()) : anchor ? setAnchor(null) : setActive(null)),
      Delete: () =>
        selected.size && !readOnly
          ? (deleteRowsWithUndo(docs, [...selected]), setSelected(new Set()))
          : clearSelection(),
      Backspace: () => clearSelection(),
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

  const clearSelection = () => {
    if (readOnly || !rect) return
    if (multi) clearRect(docs, rect, rowIds, visibleFields)
    else if (active && canEdit(fieldById(active.fieldId))) setCell(docs, active.rowId, active.fieldId, null)
  }
  const onCopy = (e: React.ClipboardEvent, cut = false) => {
    if (editing || popover || !rect || e.target !== e.currentTarget) return
    e.preventDefault()
    e.clipboardData.setData('text/plain', copyRect(docs, rect, rowIds, visibleFields))
    if (cut && !readOnly) clearRect(docs, rect, rowIds, visibleFields)
  }
  const onPaste = (e: React.ClipboardEvent) => {
    if (editing || popover || readOnly || !rect || e.target !== e.currentTarget) return
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    e.preventDefault()
    const pasted = pasteTSV(docs, text, rect, rowIds, visibleFields, () =>
      prefillFromFilter(state.view?.filter ?? null, state.fields, Date.now()),
    )
    // select what was pasted (rows added at the end appear after the query catches up)
    if (pasted && rowIds[pasted.r0]) {
      setAnchor({ rowId: rowIds[pasted.r0]!, fieldId: fieldIds[pasted.c0]! })
      const lastRow = rowIds[Math.min(pasted.r1, rowIds.length - 1)]!
      setActive({ rowId: lastRow, fieldId: fieldIds[pasted.c1]! })
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

  const onCellPointer = (rowId: string, fieldId: string, e: React.PointerEvent) => {
    const pos = { rowId, fieldId }
    if (e.shiftKey && active) {
      setAnchor((a) => a ?? active)
      setActive(pos)
      return
    }
    if (e.pointerType !== 'mouse') {
      // touch: act on a tap (no scroll in between); a tap edits right away on phones
      const x0 = e.clientX
      const y0 = e.clientY
      const t0 = e.timeStamp
      const again = active?.rowId === rowId && active.fieldId === fieldId
      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointerup', up)
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8 || ev.timeStamp - t0 > 600) return
        setActive(pos)
        setAnchor(null)
        if (phone || again) startEdit(pos)
      }
      window.addEventListener('pointerup', up)
      return
    }
    if (active?.rowId === rowId && active.fieldId === fieldId && !editing && !popover && !anchor) {
      // keep the browser from moving focus back to the grid after the editor took it
      if (startEdit(pos)) e.preventDefault()
      return
    }
    setActive(pos)
    setAnchor(null)
    // drag across cells to select a range
    const onMove = (ev: PointerEvent) => {
      const cell = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>(
        '.dbg-cell',
      )
      const rid = cell?.closest<HTMLElement>('.dbg-row')?.dataset.rowId
      const fid = cell?.dataset.fieldId
      if (!rid || !fid || (rid === rowId && fid === fieldId)) return
      setAnchor((a) => a ?? pos)
      setActive({ rowId: rid, fieldId: fid })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    if (e.pointerType === 'mouse') {
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }
  const addRowAt = (where: { afterId?: string; beforeId?: string }) => {
    const id = newRow(docs, state.fields, state.view, where)
    const first = columns[0]
    if (first) setActive({ rowId: id, fieldId: first.field.id })
    // keys go to the grid next (typing fills the new row's first cell)
    scrollRef.current?.focus({ preventScroll: true })
    return id
  }

  /** Drag a row by its handle (DB-G03); a press without moving opens the row menu. */
  const startHandle = (rowId: string, e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      // multi-select (DB-G02)
      setSelected((prev) => {
        const next = new Set(prev)
        if (e.shiftKey && prev.size) {
          const last = [...prev].at(-1)!
          const [a, b] = [rowIds.indexOf(last), rowIds.indexOf(rowId)].sort((x, y) => x - y)
          rowIds.slice(a, b! + 1).forEach((id) => next.add(id))
        } else if (next.has(rowId)) next.delete(rowId)
        else next.add(rowId)
        return next
      })
      return
    }
    const anchor = e.currentTarget as HTMLElement
    const y0 = e.clientY
    let dragging = false
    let drop = rowIds.indexOf(rowId)
    const bodyTop = () => bodyRef.current!.getBoundingClientRect().top
    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.abs(ev.clientY - y0) < 5) return
      if (!dragging) {
        if (state.view?.sorts.length) {
          toast(dt('db.row.sorted'))
          cleanup()
          return
        }
        dragging = true
      }
      const y = ev.clientY - bodyTop()
      const i = layout.indexAt(y)
      drop = y > layout.top(i) + layout.height(i) / 2 ? i + 1 : i
      setDrag({ rowId, drop })
      const el = scrollRef.current!
      const r = el.getBoundingClientRect()
      if (ev.clientY < r.top + headerH + 24) el.scrollTop -= 12
      else if (ev.clientY > r.bottom - 24) el.scrollTop += 12
    }
    const onUp = () => {
      cleanup()
      if (!dragging) return setRowMenu({ rowId, anchor })
      setDrag(null)
      const from = rowIds.indexOf(rowId)
      if (drop === from || drop === from + 1) return
      const before = rowIds[drop]
      if (before) moveRow(docs, rowId, { beforeId: before })
      else moveRow(docs, rowId, { afterId: rowIds.at(-1)! })
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', cleanupDrag)
    }
    const cleanupDrag = () => {
      cleanup()
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', cleanupDrag)
  }

  const onRowAction = (
    rowId: string,
    action: 'insert' | 'handle' | 'open',
    e: React.PointerEvent | React.MouseEvent,
  ) => {
    if (action === 'insert') addRowAt({ afterId: rowId })
    else if (action === 'open') setSheetRow(rowId)
    else startHandle(rowId, e as React.PointerEvent)
  }

  const onToggle = (rowId: string, fieldId: string) => {
    setActive({ rowId, fieldId })
    toggle({ rowId, fieldId })
  }

  useLayoutEffect(() => {
    latest.current = { onCellPointer, onToggle, onFinishEdit: finishEdit, onRowAction }
  })

  return (
    <>
      {selected.size > 0 && (
        <div className="dbg-selbar" role="toolbar" aria-label={dt('db.row.selected', { count: selected.size })}>
          <span>{dt('db.row.selected', { count: selected.size })}</span>
          {!readOnly && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                deleteRowsWithUndo(docs, [...selected])
                setSelected(new Set())
              }}
            >
              <Trash2 size={14} aria-hidden /> {dt('db.row.delete')}
            </Button>
          )}
          <Button size="sm" onClick={() => setSelected(new Set())}>
            {dt('db.row.clearSelection')}
          </Button>
        </div>
      )}
      <div
        ref={scrollRef}
        className="dbg"
        role="grid"
        aria-label={dt('db.grid.label', { title })}
        aria-rowcount={rowIds.length + 1}
        aria-colcount={columns.length}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onCopy={(e) => onCopy(e)}
        onCut={(e) => onCopy(e, true)}
        onPaste={onPaste}
      >
        <GridHeader
          columns={columns}
          colRange={colRange}
          docs={docs}
          fields={state.fields}
          view={state.view}
          primaryId={primaryId}
          readOnly={readOnly}
          height={headerH}
        />
        <div ref={bodyRef} className="dbg-body" style={{ width: totalWidth, height: layout.total }}>
          {rowIds.slice(start, end).map((id, k) => {
            const row = session.row(id)
            if (!row) return null
            const index = start + k
            return (
              <GridRow
                key={id}
                row={row}
                index={index}
                top={layout.top(index)}
                height={autoHeight ? null : rowH}
                columns={columns}
                colFrom={colRange.from}
                colTo={colRange.to}
                readOnly={readOnly}
                activeField={active?.rowId === id ? active.fieldId : null}
                rangeCols={multi && rect && index >= rect.r0 && index <= rect.r1 ? rangeKey(rect) : null}
                editing={!phone && editing?.rowId === id ? editing : null}
                actions={rowActions}
                selected={selected.has(id)}
                primaryId={primaryId}
              />
            )
          })}
          {drag && (
            <div
              className="dbg-drop"
              style={{ top: drag.drop < rowIds.length ? layout.top(drag.drop) : layout.total }}
              aria-hidden
            />
          )}
        </div>
        {!readOnly && (
          <button type="button" className="dbg-newrow" style={{ width: totalWidth }} onClick={() => addRowAt({})}>
            <Plus size={14} aria-hidden /> {dt('db.row.new')}
          </button>
        )}
        {state.view && (
          <CalcRow
            docs={docs}
            viewId={state.view.id}
            columns={columns}
            colRange={colRange}
            calcs={state.view.calcs}
            results={state.result.calcs}
            readOnly={readOnly}
          />
        )}
        {phone && editing && fieldById(editing.fieldId) && (
          <Sheet title={fieldById(editing.fieldId)!.name} onClose={() => finishEdit(null)}>
            <div className="db-pop db-sheet-editor">
              <CellEditor field={fieldById(editing.fieldId)!} initial={editing.initial} onDone={finishEdit} inSheet />
            </div>
          </Sheet>
        )}
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
        {rowMenu && (
          <Menu
            anchor={rowMenu.anchor}
            title={dt('db.row.menu')}
            onClose={() => setRowMenu(null)}
            items={[
              { label: dt('db.row.open'), icon: Maximize2, onSelect: () => setSheetRow(rowMenu.rowId) },
              ...(readOnly
                ? []
                : [
                    {
                      label: dt('db.row.insertAbove'),
                      icon: ArrowUp,
                      onSelect: () => addRowAt({ beforeId: rowMenu.rowId }),
                    },
                    {
                      label: dt('db.row.insertBelow'),
                      icon: ArrowDown,
                      onSelect: () => addRowAt({ afterId: rowMenu.rowId }),
                    },
                    { label: dt('db.row.duplicate'), icon: Copy, onSelect: () => duplicateRow(docs, rowMenu.rowId) },
                    'separator' as const,
                    {
                      label: dt('db.row.delete'),
                      icon: Trash2,
                      danger: true,
                      onSelect: () => deleteRowsWithUndo(docs, [rowMenu.rowId]),
                    },
                  ]),
            ]}
          />
        )}
        {sheetRow && (
          <RowSheet
            session={session}
            state={state}
            rowId={sheetRow}
            readOnly={readOnly}
            onClose={() => setSheetRow(null)}
          />
        )}
      </div>
    </>
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

/** Stable value for memoized rows: "c0:c1". */
const rangeKey = (r: { c0: number; c1: number }) => `${r.c0}:${r.c1}`
