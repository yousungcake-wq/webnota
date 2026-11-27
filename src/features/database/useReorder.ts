import { useRef, useState } from 'react'

/**
 * Pointer drag to reorder a short list (select options, checklist items; `axis: 'x'` for
 * view tabs): works with mouse and touch. Spread `handle(i)` on each item's drag handle and
 * put `data-reorder-item` on each item; `style(i)` moves the dragged item with the pointer.
 * With `threshold`, a press that moves less than that many pixels stays a click
 * (`wasDrag()` in the click handler tells the two apart).
 */
export function useReorder(
  onMove: (from: number, to: number) => void,
  { axis = 'y', threshold = 0 }: { axis?: 'x' | 'y'; threshold?: number } = {},
) {
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; moved: boolean } | null>(null)
  const geo = useRef<{ y0: number; mids: number[] } | null>(null)
  const dragged = useRef(false)
  const pos = (e: { clientX: number; clientY: number }) => (axis === 'x' ? e.clientX : e.clientY)

  const handle = (index: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      dragged.current = false
      if (e.button !== 0) return
      const item = e.currentTarget.closest<HTMLElement>('[data-reorder-item]')
      const items = item?.parentElement?.querySelectorAll<HTMLElement>(':scope > [data-reorder-item]')
      if (!items) return
      if (!threshold) e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      geo.current = {
        y0: pos(e),
        mids: [...items].map((el) => {
          const r = el.getBoundingClientRect()
          return axis === 'x' ? r.left + r.width / 2 : r.top + r.height / 2
        }),
      }
      setDrag({ from: index, to: index, dy: 0, moved: !threshold })
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = geo.current
      if (!g || !drag) return
      const dy = pos(e) - g.y0
      if (!drag.moved && Math.abs(dy) < threshold) return
      const y = g.mids[drag.from]! + dy
      let to = g.mids.findIndex((m) => y < m)
      if (to < 0) to = g.mids.length - 1
      else if (to > drag.from) to -= 1
      setDrag({ ...drag, to, dy, moved: true })
    },
    onPointerUp: () => {
      if (drag?.moved && drag.to !== drag.from) onMove(drag.from, drag.to)
      dragged.current = !!drag?.moved && threshold > 0
      geo.current = null
      setDrag(null)
    },
    onPointerCancel: () => {
      geo.current = null
      setDrag(null)
    },
  })
  const style = (index: number): React.CSSProperties | undefined =>
    drag?.from === index && drag.moved
      ? { transform: `translate${axis === 'x' ? 'X' : 'Y'}(${drag.dy}px)`, zIndex: 1, position: 'relative' }
      : undefined
  /** In a click handler: the press was a drag, not a click. */
  const wasDrag = () => dragged.current
  return { handle, style, dragging: drag?.moved ?? false, wasDrag }
}
