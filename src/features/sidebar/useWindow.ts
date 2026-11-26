import { useLayoutEffect, useState, type RefObject } from 'react'

const OVERSCAN = 10
/** Lists up to this size render fully (spec/10 §2: virtualize beyond 50 items). */
const FULL_RENDER_MAX = 50

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if (o === 'auto' || o === 'scroll') return p
  }
  return null
}

/**
 * The slice of a fixed-row-height list that is on screen, for a list living inside some
 * scrolling ancestor (the sidebar or the phone home screen). Row height is measured from
 * the rendered rows, so desktop (32px) and touch (44px) both work.
 */
export function useWindow(listRef: RefObject<HTMLElement | null>, count: number) {
  const [state, setState] = useState({ start: 0, end: Math.min(count, FULL_RENDER_MAX * 2), rowHeight: 32 })
  const virtual = count > FULL_RENDER_MAX

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list || !virtual) return
    const scroller = scrollParent(list)
    if (!scroller) return
    const update = () => {
      const row = list.querySelector<HTMLElement>('[data-row]')
      const h = row?.offsetHeight || 32
      const hiddenAbove = scroller.getBoundingClientRect().top - list.getBoundingClientRect().top
      const start = Math.max(0, Math.floor(hiddenAbove / h) - OVERSCAN)
      const end = Math.min(count, Math.ceil((hiddenAbove + scroller.clientHeight) / h) + OVERSCAN)
      setState((s) => (s.start === start && s.end === end && s.rowHeight === h ? s : { start, end, rowHeight: h }))
    }
    update()
    scroller.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(scroller)
    return () => {
      scroller.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [listRef, count, virtual])

  return virtual ? state : { start: 0, end: count, rowHeight: state.rowHeight }
}
