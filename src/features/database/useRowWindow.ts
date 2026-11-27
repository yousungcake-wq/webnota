import { useLayoutEffect, useState, type RefObject } from 'react'

const OVERSCAN = 8

/**
 * Rows of a fixed-height list inside its own scroll box that are on screen (+ overscan),
 * and the box's horizontal scroll range for column virtualization (M4-08).
 */
export function useRowWindow(
  ref: RefObject<HTMLElement | null>,
  count: number,
  rowHeight: number,
  headerHeight: number,
) {
  const [win, setWin] = useState({ start: 0, end: Math.min(count, 40), left: 0, width: 1200 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const top = Math.max(0, el.scrollTop - headerHeight)
      const start = Math.max(0, Math.floor(top / rowHeight) - OVERSCAN)
      const end = Math.min(count, Math.ceil((top + el.clientHeight) / rowHeight) + OVERSCAN)
      const left = el.scrollLeft
      const width = el.clientWidth
      setWin((w) =>
        w.start === start && w.end === end && w.left === left && w.width === width ? w : { start, end, left, width },
      )
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [ref, count, rowHeight, headerHeight])
  return win
}
