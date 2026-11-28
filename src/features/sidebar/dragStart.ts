import type * as DragNs from './drag'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { ws } from '@/core/docs/workspace'
import { listViews, moveView, type ViewMeta } from '@/core/model/views'
import { toggleExpanded } from '@/core/store/prefs'
import type { TreeRow } from './flatten'
import { haptic } from '@/platform/haptics'

/**
 * Small eager part of tree drag & drop (WS-03): decides when a press becomes a drag —
 * mouse after moving 5px, touch after a 500ms long press without moving — then loads
 * the drag controller (`drag.ts`). A long press released where it began opens the item's
 * menu instead (MB-12, M7-03): the row lifts, and moving the finger turns it into a drag.
 */
const MOUSE_SLOP = 5
const TOUCH_SLOP = 8
const LONG_PRESS = 500

type DragModule = typeof DragNs
let loaded: DragModule | null = null
export const preloadDrag = () =>
  import('./drag').then((m) => {
    loaded = m
    return m
  })

/**
 * Turns a press into a drag: mouse after moving 5px, touch after a 500ms long press
 * without moving (a moving finger is scrolling). Calls `start` with the pointer position.
 */
export function onPress(e: ReactPointerEvent<HTMLElement>, start: (x: number, y: number, touch: boolean) => void) {
  if (e.pointerType === 'mouse' && e.button !== 0) return false
  const touch = e.pointerType !== 'mouse'
  const x0 = e.clientX
  const y0 = e.clientY
  let timer: ReturnType<typeof setTimeout> | undefined
  const cleanup = () => {
    clearTimeout(timer)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', cleanup)
    window.removeEventListener('pointercancel', cleanup)
  }
  const go = (x: number, y: number) => {
    cleanup()
    start(x, y, touch)
  }
  const onMove = (ev: PointerEvent) => {
    const d = Math.hypot(ev.clientX - x0, ev.clientY - y0)
    if (touch) {
      if (d > TOUCH_SLOP) cleanup()
    } else if (d > MOUSE_SLOP) go(ev.clientX, ev.clientY)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', cleanup)
  window.addEventListener('pointercancel', cleanup)
  if (touch)
    timer = setTimeout(() => {
      haptic()
      go(x0, y0)
    }, LONG_PRESS)
  return true
}

const pressedId = (e: ReactPointerEvent<HTMLElement>, attr = 'id') => {
  const target = e.target as HTMLElement
  if (target.closest('button, input, .tree-actions')) return null
  return target.closest<HTMLElement>(`[data-${attr}]`)?.getAttribute(`data-${attr}`) ?? null
}

/** Runs `run` once the drag module is loaded — unless the pointer was released meanwhile. */
function whenLoaded(run: (m: DragModule) => void) {
  // Already loaded (hover preloads it): start synchronously, before the next pointer event.
  if (loaded) return run(loaded)
  let released = false
  const up = () => (released = true)
  window.addEventListener('pointerup', up, { once: true })
  window.addEventListener('pointercancel', up, { once: true })
  void preloadDrag().then((m) => {
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    if (!released) run(m)
  })
}

export function beginDrag(
  e: ReactPointerEvent<HTMLElement>,
  list: HTMLElement | null,
  spaceId: string,
  rows: () => TreeRow[],
  views: () => ViewMeta[],
  onHold?: (id: string) => void,
) {
  const id = pressedId(e)
  if (!list || !id) return
  const hold = onHold && (() => onHold(id))
  if (
    onPress(
      e,
      (x, y, touch) =>
        void preloadDrag().then((m) => m.startDrag({ list, id, rows, views, spaceId, x, y, touch, onHold: hold })),
    )
  )
    void preloadDrag()
}

/** Reorder drag for a flat list of `[data-<attr>]` items (favorites; spaces use `space-id`). */
export function beginListDrag(
  e: ReactPointerEvent<HTMLElement>,
  list: HTMLElement | null,
  onDrop: (id: string, index: number) => void,
  attr = 'id',
  onHold?: (id: string) => void,
) {
  const id = pressedId(e, attr)
  if (!list || !id) return
  const hold = onHold && (() => onHold(id))
  if (
    onPress(e, (x, y, touch) =>
      whenLoaded((m) => m.startListDrag({ list, id, x, y, touch, onDrop, attr, onHold: hold })),
    )
  )
    void preloadDrag()
}

/** Keyboard moves on a focused row (WS-03): Alt+Shift+↑/↓ reorder, →/← indent/outdent. */
export function keyboardMove(e: ReactKeyboardEvent, view: ViewMeta) {
  if (!e.altKey || !e.shiftKey) return
  const doc = ws()
  const live = listViews(doc).filter((v) => !v.deletedAt && v.spaceId === view.spaceId)
  const sibs = live.filter((v) => v.parentId === view.parentId)
  const at = sibs.findIndex((v) => v.id === view.id)
  const to = (parentId: string | null, index: number) =>
    moveView(doc, view.id, { parentId, spaceId: view.spaceId, index })
  let handled = true
  if (e.key === 'ArrowUp' && at > 0) to(view.parentId, at - 1)
  else if (e.key === 'ArrowDown' && at < sibs.length - 1) to(view.parentId, at + 1)
  else if (e.key === 'ArrowRight' && at > 0) {
    const newParent = sibs[at - 1]!
    to(newParent.id, live.filter((v) => v.parentId === newParent.id).length)
    toggleExpanded(newParent.id, true)
  } else if (e.key === 'ArrowLeft' && view.parentId) {
    const parent = live.find((v) => v.id === view.parentId)
    const pSibs = live.filter((v) => v.parentId === (parent?.parentId ?? null))
    to(parent?.parentId ?? null, pSibs.findIndex((v) => v.id === view.parentId) + 1)
  } else handled = false
  if (handled) {
    e.preventDefault()
    // Keep focus on the moved row after React re-renders it.
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-id="${CSS.escape(view.id)}"] .tree-link`)?.focus(),
    )
  }
}
