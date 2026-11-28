import { useRef, useState } from 'react'

/** Where a dragged card would land: column `key`, before card `beforeId` (null: at the end). */
export interface CardDrop {
  key: string
  beforeId: string | null
}

export interface CardDrag {
  rowId: string
  from: string
  drop: CardDrop | null
  x: number
  y: number
  /** Offset of the pointer inside the card, so the ghost does not jump. */
  dx: number
  dy: number
  width: number
}

/**
 * A finger drag in progress. The board blocks touch scrolling with a touchmove listener
 * that exists from mount (`blockTouchScroll`): Chrome only lets touchmove cancel scrolling
 * when a blocking listener was there when the touch started.
 */
let touchDragging = false
export const setTouchDragging = (v: boolean) => {
  touchDragging = v
}
export function blockTouchScroll(el: HTMLElement) {
  const onMove = (e: TouchEvent) => {
    if (touchDragging && e.cancelable) e.preventDefault()
  }
  el.addEventListener('touchmove', onMove, { passive: false })
  return () => el.removeEventListener('touchmove', onMove)
}

const LONG_PRESS_MS = 350
const MOVE_TOLERANCE = 8
const EDGE = 48
const SPEED = 14

/**
 * Card dragging on the board (M5-04, DB-K03, MB-32): a mouse drags after moving 5px; a
 * finger after a long press (moving earlier scrolls instead). While dragging, the pointer
 * near an edge scrolls the board sideways or the column under it up and down. The drop
 * target is found from the rendered cards under the pointer; `ids(key)` gives a column's
 * full card list for drops below the rendered window.
 */
export function useCardDrag(opts: {
  board: () => HTMLElement | null
  ids: (key: string) => string[]
  onDrop: (rowId: string, from: string, drop: CardDrop) => void
  canStart: () => boolean
}) {
  const [drag, setDrag] = useState<CardDrag | null>(null)
  const dragged = useRef(false)

  const start = (e: React.PointerEvent<HTMLElement>, rowId: string, from: string) => {
    if (e.button !== 0) return
    dragged.current = false
    const card = e.currentTarget
    const touch = e.pointerType === 'touch'
    const x0 = e.clientX
    const y0 = e.clientY
    let x = x0
    let y = y0
    let active = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let frame = 0
    let current: CardDrag | null = null

    const dropAt = (px: number, py: number): CardDrop | null => {
      const col = document.elementFromPoint(px, py)?.closest<HTMLElement>('.dbk-col[data-group]')
      if (!col) return current?.drop ?? null
      const key = col.dataset.group!
      const cards = [...col.querySelectorAll<HTMLElement>('.dbk-card[data-row-id]')].filter(
        (c) => c.dataset.rowId !== rowId,
      )
      cards.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      for (const c of cards) {
        const r = c.getBoundingClientRect()
        if (py < r.top + r.height / 2) return { key, beforeId: c.dataset.rowId! }
      }
      // below the rendered cards: before the next (unrendered) card, else at the end
      const list = opts.ids(key).filter((id) => id !== rowId)
      const last = cards.at(-1)?.dataset.rowId
      return { key, beforeId: last ? (list[list.indexOf(last) + 1] ?? null) : null }
    }
    const update = () => {
      const r = card.getBoundingClientRect()
      const prev = current
      current = {
        rowId,
        from,
        drop: dropAt(x, y),
        x,
        y,
        dx: current?.dx ?? x0 - r.left,
        dy: current?.dy ?? y0 - r.top,
        width: current?.width ?? r.width,
      }
      // the ghost follows the pointer without React; the board re-renders only when the
      // drop target changes (M5-12: 10k cards stay smooth)
      const ghost = document.querySelector<HTMLElement>('.dbk-ghost')
      if (ghost) {
        ghost.style.left = `${current.x - current.dx}px`
        ghost.style.top = `${current.y - current.dy}px`
      }
      const same =
        prev && ghost && prev.drop?.key === current.drop?.key && prev.drop?.beforeId === current.drop?.beforeId
      if (!same) setDrag(current)
    }
    const autoScroll = () => {
      frame = requestAnimationFrame(autoScroll)
      const board = opts.board()
      if (!board) return
      const b = board.getBoundingClientRect()
      if (x < b.left + EDGE) board.scrollLeft -= SPEED
      else if (x > b.right - EDGE) board.scrollLeft += SPEED
      const list = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>('.dbk-col')
        ?.querySelector<HTMLElement>('.dbk-cards')
      if (list) {
        const l = list.getBoundingClientRect()
        if (y < l.top + EDGE / 2) list.scrollTop -= SPEED
        else if (y > l.bottom - EDGE / 2) list.scrollTop += SPEED
      }
      if (current) update()
    }
    const activate = () => {
      if (!opts.canStart()) return cleanup()
      active = true
      touchDragging = touch
      dragged.current = true
      if (touch) navigator.vibrate?.(10)
      update()
      frame = requestAnimationFrame(autoScroll)
    }
    const onMove = (ev: PointerEvent) => {
      x = ev.clientX
      y = ev.clientY
      if (active) return update()
      const far = Math.hypot(x - x0, y - y0)
      if (touch) {
        if (far > MOVE_TOLERANCE) cleanup() // a scroll, not a drag
      } else if (far > 5) activate()
    }
    const onUp = () => {
      const done = active && current?.drop ? current : null
      cleanup()
      if (done?.drop) opts.onDrop(rowId, from, done.drop)
    }
    const cleanup = () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', cleanup)
      touchDragging = false
      current = null
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', cleanup)
    if (touch) timer = setTimeout(activate, LONG_PRESS_MS)
  }
  /** In a card's click handler: the press was a drag. */
  const wasDrag = () => {
    const d = dragged.current
    dragged.current = false
    return d
  }
  return { drag, start, wasDrag }
}
