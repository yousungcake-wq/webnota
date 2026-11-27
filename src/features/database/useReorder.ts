import { useRef, useState } from 'react'

/**
 * Pointer drag to reorder a short vertical list (select options, checklist items): works
 * with mouse and touch. Spread `handle(i)` on each item's drag handle and put
 * `data-reorder-item` on each item; `style(i)` moves the dragged item with the pointer.
 */
export function useReorder(onMove: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number } | null>(null)
  const geo = useRef<{ y0: number; mids: number[] } | null>(null)

  const handle = (index: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return
      const item = e.currentTarget.closest<HTMLElement>('[data-reorder-item]')
      const items = item?.parentElement?.querySelectorAll<HTMLElement>(':scope > [data-reorder-item]')
      if (!items) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      geo.current = {
        y0: e.clientY,
        mids: [...items].map((el) => {
          const r = el.getBoundingClientRect()
          return r.top + r.height / 2
        }),
      }
      setDrag({ from: index, to: index, dy: 0 })
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = geo.current
      if (!g || !drag) return
      const dy = e.clientY - g.y0
      const y = g.mids[drag.from]! + dy
      let to = g.mids.findIndex((m) => y < m)
      if (to < 0) to = g.mids.length - 1
      else if (to > drag.from) to -= 1
      setDrag({ ...drag, to, dy })
    },
    onPointerUp: () => {
      if (drag && drag.to !== drag.from) onMove(drag.from, drag.to)
      geo.current = null
      setDrag(null)
    },
    onPointerCancel: () => {
      geo.current = null
      setDrag(null)
    },
  })
  const style = (index: number): React.CSSProperties | undefined =>
    drag?.from === index ? { transform: `translateY(${drag.dy}px)`, zIndex: 1, position: 'relative' } : undefined
  return { handle, style, dragging: drag !== null }
}
