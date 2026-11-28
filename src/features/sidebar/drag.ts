import { moveView, type ViewMeta } from '@/core/model/views'
import { ws } from '@/core/docs/workspace'
import { toggleExpanded } from '@/core/store/prefs'
import { dropTarget, zoneAt, type DropTarget } from './drop'
import type { TreeRow } from './flatten'

/**
 * Pointer drag of a sidebar row (WS-03), loaded on the first drag. Hit-tests rows by
 * their `data-index`, shows a ghost and an indented drop line, auto-scrolls near the
 * edges, expands a collapsed parent after hovering "inside" it, and moves on release.
 * Escape cancels.
 */
export interface DragContext {
  list: HTMLElement
  id: string
  rows: () => TreeRow[]
  views: () => ViewMeta[]
  spaceId: string
  x: number
  y: number
  /** Touch drags must stop the page from scrolling. */
  touch: boolean
  /** Touch: released without moving after the long press (MB-12) — not a drop. */
  onHold?: () => void
}

/** A long press that ends where it began is a "hold" (opens the item's menu), not a drag. */
const HOLD_SLOP = 8
function holdTracker(ctx: { x: number; y: number; touch: boolean; onHold?: () => void }) {
  let moved = false
  return {
    move: (x: number, y: number) => {
      if (Math.hypot(x - ctx.x, y - ctx.y) > HOLD_SLOP) moved = true
    },
    held: () => ctx.touch && !moved && !!ctx.onHold,
  }
}

const EXPAND_DELAY = 600
const EDGE = 40

function scrollParent(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if (o === 'auto' || o === 'scroll') return p
  }
  return document.documentElement
}

export function startDrag(ctx: DragContext) {
  const source = ctx.list.querySelector<HTMLElement>(`[data-id="${CSS.escape(ctx.id)}"] .tree-row`)
  const scroller = scrollParent(ctx.list)
  const ghost = document.createElement('div')
  ghost.className = 'tree-ghost'
  ghost.textContent = source?.querySelector('.tree-title')?.textContent ?? ''
  const line = document.createElement('div')
  line.className = 'tree-drop-line'
  document.body.append(ghost, line)
  source?.classList.add('is-dragging')
  document.body.classList.add('is-tree-dragging')

  let target: DropTarget | null = null
  let insideRow: HTMLElement | null = null
  let expandTimer: ReturnType<typeof setTimeout> | undefined
  let lastY = ctx.y
  let raf = 0
  const hold = holdTracker(ctx)

  const place = (x: number, y: number) => {
    lastY = y
    ghost.style.transform = `translate(${x + 12}px, ${y + 8}px)`
    const el = document
      .elementFromPoint(ctx.list.getBoundingClientRect().left + 24, y)
      ?.closest<HTMLElement>('[data-index]')
    insideRow?.classList.remove('is-drop-inside')
    insideRow = null
    line.style.display = 'none'
    target = null
    if (!el || !ctx.list.contains(el)) return
    const rowEl = el.querySelector<HTMLElement>('.tree-row') ?? el
    const rect = rowEl.getBoundingClientRect()
    const index = Number(el.dataset.index)
    const zone = zoneAt(y - rect.top, rect.height)
    target = dropTarget(ctx.rows(), ctx.views(), index, zone, ctx.id)
    clearTimeout(expandTimer)
    if (!target) return
    const row = ctx.rows()[index]
    if (zone === 'inside') {
      insideRow = rowEl
      rowEl.classList.add('is-drop-inside')
      if (row?.hasChildren && !row.open) expandTimer = setTimeout(() => toggleExpanded(row.view.id, true), EXPAND_DELAY)
    } else {
      const listRect = ctx.list.getBoundingClientRect()
      line.style.display = 'block'
      line.style.top = `${zone === 'before' ? rect.top : rect.bottom}px`
      line.style.left = `${listRect.left + 8 + target.depth * 16}px`
      line.style.width = `${listRect.width - 16 - target.depth * 16}px`
    }
  }

  // Auto-scroll while the pointer is near the top/bottom edge.
  const tick = () => {
    const r = scroller.getBoundingClientRect()
    const dy = lastY < r.top + EDGE ? -8 : lastY > r.bottom - EDGE ? 8 : 0
    if (dy) scroller.scrollTop += dy
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  const onMove = (e: PointerEvent) => {
    hold.move(e.clientX, e.clientY)
    place(e.clientX, e.clientY)
  }
  const onTouchMove = (e: TouchEvent) => e.preventDefault()
  const finish = (commit: boolean) => {
    cancelAnimationFrame(raf)
    clearTimeout(expandTimer)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('touchmove', onTouchMove)
    ghost.remove()
    line.remove()
    insideRow?.classList.remove('is-drop-inside')
    source?.classList.remove('is-dragging')
    document.body.classList.remove('is-tree-dragging')
    // The release would otherwise "click" the row link (the click follows pointerup at once).
    const swallow = (e: MouseEvent) => e.preventDefault()
    window.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 100)
    if (commit && target) {
      moveView(ws(), ctx.id, { parentId: target.parentId, spaceId: ctx.spaceId, index: target.index })
      if (target.parentId) toggleExpanded(target.parentId, true)
    }
  }
  const onUp = () => {
    const held = hold.held()
    finish(!held)
    if (held) ctx.onHold!()
  }
  const onCancel = () => finish(false)
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      finish(false)
    }
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey, true)
  if (ctx.touch) window.addEventListener('touchmove', onTouchMove, { passive: false })
  place(ctx.x, ctx.y)
}

/** Reorder within a flat list (favorites): drop line between items, `onDrop(id, index)`. */
export function startListDrag(ctx: {
  list: HTMLElement
  id: string
  x: number
  y: number
  touch: boolean
  onDrop: (id: string, index: number) => void
  /** Item attribute holding the id (`data-<attr>`), default `id`. */
  attr?: string
  onHold?: () => void
}) {
  const hold = holdTracker(ctx)
  const attr = `data-${ctx.attr ?? 'id'}`
  const items = () => [...ctx.list.querySelectorAll<HTMLElement>(`[${attr}]`)]
  const source = items().find((el) => el.getAttribute(attr) === ctx.id)
  const ghost = document.createElement('div')
  ghost.className = 'tree-ghost'
  ghost.textContent = (source?.querySelector('[data-drag-label]') ?? source)?.textContent ?? ''
  const line = document.createElement('div')
  line.className = 'tree-drop-line'
  document.body.append(ghost, line)
  source?.classList.add('is-dragging')
  document.body.classList.add('is-tree-dragging')
  let index = -1
  const place = (x: number, y: number) => {
    ghost.style.transform = `translate(${x + 12}px, ${y + 8}px)`
    const others = items().filter((el) => el !== source)
    index = others.findIndex((el) => {
      const r = el.getBoundingClientRect()
      return y < r.top + r.height / 2
    })
    if (index < 0) index = others.length
    const ref = others[index] ?? others.at(-1)
    if (!ref) return
    const r = ref.getBoundingClientRect()
    line.style.display = 'block'
    line.style.top = `${index < others.length ? r.top : r.bottom}px`
    line.style.left = `${r.left + 8}px`
    line.style.width = `${r.width - 16}px`
  }
  const onMove = (e: PointerEvent) => {
    hold.move(e.clientX, e.clientY)
    place(e.clientX, e.clientY)
  }
  const onTouchMove = (e: TouchEvent) => e.preventDefault()
  const finish = (commit: boolean) => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('touchmove', onTouchMove)
    ghost.remove()
    line.remove()
    source?.classList.remove('is-dragging')
    document.body.classList.remove('is-tree-dragging')
    const swallow = (e: MouseEvent) => e.preventDefault()
    window.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 100)
    if (commit && index >= 0) ctx.onDrop(ctx.id, index)
  }
  const onUp = () => {
    const held = hold.held()
    finish(!held)
    if (held) ctx.onHold!()
  }
  const onCancel = () => finish(false)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  if (ctx.touch) window.addEventListener('touchmove', onTouchMove, { passive: false })
  place(ctx.x, ctx.y)
}
