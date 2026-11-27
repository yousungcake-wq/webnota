import { useLayoutEffect, useState, type RefObject } from 'react'

export interface ScrollBox {
  top: number
  left: number
  height: number
  width: number
}

/** Scroll position and size of a scrolling element, updated on scroll and resize. */
export function useScrollBox(ref: RefObject<HTMLElement | null>): ScrollBox {
  const [box, setBox] = useState<ScrollBox>({ top: 0, left: 0, height: 800, width: 1200 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const next = { top: el.scrollTop, left: el.scrollLeft, height: el.clientHeight, width: el.clientWidth }
      setBox((b) =>
        b.top === next.top && b.left === next.left && b.height === next.height && b.width === next.width ? b : next,
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
  }, [ref])
  return box
}
