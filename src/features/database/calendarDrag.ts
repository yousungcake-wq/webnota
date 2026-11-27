import { useRef, useState } from 'react'
import { setTouchDragging } from './boardDrag'

export interface DayDrag {
  rowId: string
  /** The day the pointer grabbed the event on (null: from the "no date" panel). */
  from: number | null
  over: number | null
  x: number
  y: number
  label: string
}

const LONG_PRESS_MS = 350

/** The calendar day cell under a point (event bars lie on top of the cells). */
export function dayAt(x: number, y: number): number | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const day = (el as HTMLElement).closest?.<HTMLElement>('[data-day]')
    if (day) return Number(day.dataset.day)
  }
  return null
}

/**
 * Dragging calendar events to another day (M5-07, DB-C04) and rows from the "no date"
 * panel onto a day (DB-C05): mouse after 5px, finger after a long press.
 */
export function useDayDrag(onDrop: (rowId: string, from: number | null, to: number) => void) {
  const [drag, setDrag] = useState<DayDrag | null>(null)
  const dragged = useRef(false)
  const start = (e: React.PointerEvent<HTMLElement>, rowId: string, fromPanel: boolean, label: string) => {
    if (e.button !== 0) return
    dragged.current = false
    const touch = e.pointerType === 'touch'
    const x0 = e.clientX
    const y0 = e.clientY
    const from = fromPanel ? null : dayAt(x0, y0)
    let cur: DayDrag | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const set = (x: number, y: number) => {
      cur = { rowId, from, over: dayAt(x, y), x, y, label }
      setDrag(cur)
    }
    const activate = (x: number, y: number) => {
      dragged.current = true
      setTouchDragging(touch)
      set(x, y)
    }
    const onMove = (ev: PointerEvent) => {
      if (cur) return set(ev.clientX, ev.clientY)
      const far = Math.hypot(ev.clientX - x0, ev.clientY - y0)
      if (touch) {
        if (far > 8) cleanup()
      } else if (far > 5) activate(ev.clientX, ev.clientY)
    }
    const onUp = () => {
      const done: DayDrag | null = cur
      cleanup()
      if (done?.over != null && done.over !== done.from) onDrop(rowId, done.from, done.over)
    }
    const cleanup = () => {
      clearTimeout(timer)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', cleanup)
      setTouchDragging(false)
      cur = null
      setDrag(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', cleanup)
    if (touch) timer = setTimeout(() => activate(x0, y0), LONG_PRESS_MS)
  }
  const wasDrag = () => {
    const d = dragged.current
    dragged.current = false
    return d
  }
  return { drag, start, wasDrag }
}
