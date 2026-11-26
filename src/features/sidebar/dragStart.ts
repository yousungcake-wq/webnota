import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { ws } from '@/core/docs/workspace'
import { listViews, moveView, type ViewMeta } from '@/core/model/views'
import { toggleExpanded } from '@/core/store/prefs'
import type { TreeRow } from './flatten'

/**
 * Small eager part of tree drag & drop (WS-03): decides when a press becomes a drag —
 * mouse after moving 5px, touch after a 400ms long press without moving — then loads
 * the drag controller (`drag.ts`).
 */
const MOUSE_SLOP = 5
const TOUCH_SLOP = 8
const LONG_PRESS = 400

export const preloadDrag = () => import('./drag')

export function beginDrag(
  e: ReactPointerEvent<HTMLElement>,
  list: HTMLElement | null,
  spaceId: string,
  rows: () => TreeRow[],
  views: () => ViewMeta[],
) {
  if (!list || (e.pointerType === 'mouse' && e.button !== 0)) return
  const target = e.target as HTMLElement
  if (target.closest('button, input, .tree-actions')) return
  const id = target.closest<HTMLElement>('[data-id]')?.dataset.id
  if (!id) return
  void preloadDrag()
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
  const start = (x: number, y: number) => {
    cleanup()
    void preloadDrag().then((m) => m.startDrag({ list, id, rows, views, spaceId, x, y, touch }))
  }
  const onMove = (ev: PointerEvent) => {
    const d = Math.hypot(ev.clientX - x0, ev.clientY - y0)
    if (touch) {
      if (d > TOUCH_SLOP) cleanup() // the finger is scrolling, not dragging
    } else if (d > MOUSE_SLOP) start(ev.clientX, ev.clientY)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', cleanup)
  window.addEventListener('pointercancel', cleanup)
  if (touch) {
    timer = setTimeout(() => {
      navigator.vibrate?.(10)
      start(x0, y0)
    }, LONG_PRESS)
  }
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
