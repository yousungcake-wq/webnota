/**
 * Bottom sheet drags (MB-10, M7-01), loaded on the first sheet so the start bundle stays
 * small. The handle drags with any pointer and a tap on it toggles the height steps; the
 * content drags with a finger while scrolled to the top (down) or while the sheet can
 * still grow (up). Touch events there, so scrolling stays native otherwise.
 */
export interface SheetApi {
  full: () => boolean
  /** The content fits without scrolling (nothing to expand). */
  fits: () => boolean
  setDy: (d: number | null) => void
  /** End of a drag of `d` px (positive: down). */
  settle: (d: number) => void
  toggle: () => void
}

/** The nearest scrolled element between `target` and the sheet (the sheet itself included). */
function scrolledAbove(target: Element | null, sheet: HTMLElement) {
  for (let el = target; el && sheet.contains(el); el = el.parentElement) {
    if (el.scrollTop > 0) return true
    if (el === sheet) break
  }
  return false
}
/** Sliders and marked horizontal scrollers keep their own touch gestures. */
const ownsGesture = (target: Element) => !!target.closest('input[type="range"], [data-sheet-nodrag]')

export function attachSheetGestures(sheet: HTMLElement, api: SheetApi) {
  const handle = sheet.querySelector<HTMLElement>('.sheet-handle')
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || !handle) return
    handle.setPointerCapture(e.pointerId)
    const start = e.clientY
    let d = 0
    const move = (ev: PointerEvent) => {
      d = ev.clientY - start
      api.setDy(d)
    }
    const done = (ok: boolean) => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', cancel)
      if (!ok) return api.setDy(null)
      if (Math.abs(d) >= 6) return api.settle(d)
      api.setDy(null)
      api.toggle()
    }
    const up = () => done(true)
    const cancel = () => done(false)
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', cancel)
  }

  let start: { y: number; x: number; top: boolean } | null = null
  let dragging = false
  let d = 0
  const onStart = (e: TouchEvent) => {
    const target = e.target as Element
    const t = e.touches[0]
    start = null
    if (e.touches.length !== 1 || !t || target.closest('.sheet-handle') || ownsGesture(target)) return
    start = { y: t.clientY, x: t.clientX, top: !scrolledAbove(target, sheet) }
    dragging = false
    d = 0
  }
  const onMove = (e: TouchEvent) => {
    const t = e.touches[0]
    if (!start || !t) return
    const dy = t.clientY - start.y
    if (!dragging) {
      if (Math.abs(t.clientX - start.x) > Math.abs(dy)) return void (start = null)
      const down = dy > 8 && start.top
      const up = dy < -8 && !api.full() && !api.fits()
      if (!down && !up) {
        if (Math.abs(dy) > 8) start = null // a normal scroll
        return
      }
      dragging = true
      start.y = t.clientY
      ;(document.activeElement as HTMLElement | null)?.blur?.()
    }
    if (e.cancelable) e.preventDefault()
    d = t.clientY - start.y
    api.setDy(d)
  }
  const onEnd = () => {
    if (dragging) api.settle(d)
    start = null
    dragging = false
  }
  handle?.addEventListener('pointerdown', onPointerDown)
  sheet.addEventListener('touchstart', onStart, { passive: true })
  sheet.addEventListener('touchmove', onMove, { passive: false })
  sheet.addEventListener('touchend', onEnd)
  sheet.addEventListener('touchcancel', onEnd)
  return () => {
    handle?.removeEventListener('pointerdown', onPointerDown)
    sheet.removeEventListener('touchstart', onStart)
    sheet.removeEventListener('touchmove', onMove)
    sheet.removeEventListener('touchend', onEnd)
    sheet.removeEventListener('touchcancel', onEnd)
  }
}
