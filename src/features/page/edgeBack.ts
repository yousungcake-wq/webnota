import { useEffect } from 'react'

const EDGE = 20
const TRIGGER = 72
const MAX = 96

/** iOS Safari has its own edge swipe back; ours would fight it (MB-13). */
const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/**
 * Swipe from the left edge of the page screen to go back (MB-13, M7-04), Android only: an
 * arrow follows the finger and going back happens past 72px. Not started inside a
 * database (its grids and boards scroll sideways). With Android gesture navigation the
 * system takes edge swipes itself, so this only runs where it does not.
 */
export function useEdgeBack(enabled: boolean, back: () => void) {
  useEffect(() => {
    if (!enabled || isIOS()) return
    let start: { x: number; y: number } | null = null
    let active = false
    let arrow: HTMLElement | null = null
    let dx = 0
    const show = (d: number) => {
      if (!arrow) {
        arrow = document.createElement('div')
        arrow.className = 'edge-back'
        arrow.setAttribute('aria-hidden', 'true')
        document.body.append(arrow)
      }
      const x = Math.min(d, MAX)
      arrow.style.transform = `translate(${x - 44}px, -50%)`
      arrow.classList.toggle('is-ready', d >= TRIGGER)
    }
    const reset = () => {
      arrow?.remove()
      arrow = null
      start = null
      active = false
      dx = 0
    }
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      reset()
      if (e.touches.length !== 1 || !t || t.clientX > EDGE) return
      const target = e.target as Element
      if (target.closest('.db-view, .sheet, .db-row-modal, input, textarea')) return
      start = { x: t.clientX, y: t.clientY }
    }
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!start || !t) return
      dx = t.clientX - start.x
      const dy = t.clientY - start.y
      if (!active) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > dx) return reset() // a scroll
        if (dx < 12) return
        active = true
      }
      if (e.cancelable) e.preventDefault()
      show(dx)
    }
    const onEnd = () => {
      const go = active && dx >= TRIGGER
      reset()
      if (go) back()
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', reset)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', reset)
      reset()
    }
  }, [enabled, back])
}
