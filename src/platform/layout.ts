import { useSyncExternalStore } from 'react'

/**
 * Layout class (spec/08 §1, spec/12 §3). Screen size and input type are separate:
 * a touch tablet gets the wide layout with touch controls.
 *
 * | layout  | rule                                                  |
 * |---------|-------------------------------------------------------|
 * | phone   | touch: width < 768 · mouse: width < 480               |
 * | tablet  | touch: 768 ≤ width < 1024 · mouse: 480 ≤ width < 768  |
 * | desktop | everything else                                       |
 *
 * A mouse-driven split-screen window (feedback 2-9) stays on the wide layout (sidebar as
 * a drawer) down to 480px instead of switching to the phone UI at 768.
 *
 * A touch device whose screen's short side is under 500px is a phone in any orientation
 * (MB-18, M7-08): turning a phone sideways keeps the phone UI (and its open sheet, caret
 * and scroll) instead of switching to the tablet layout. The screen, not the window: the
 * on-screen keyboard must not turn a tablet into a phone.
 */
export type LayoutKind = 'phone' | 'tablet' | 'desktop'
export interface Layout {
  layout: LayoutKind
  /** Primary pointer is coarse (finger): bigger targets, keyboard toolbar, sheets. */
  isTouch: boolean
}

export const PHONE_MAX = 767
export const TABLET_MAX = 1023
/** Phone layout limit with a mouse (fine pointer). */
export const MOUSE_PHONE_MAX = 479
/** Touch screens with a shorter side than this are phones, also in landscape. */
export const PHONE_SHORT_SIDE = 500

export function computeLayout(width: number, isTouch: boolean, screenShortSide = Infinity): Layout {
  const layout: LayoutKind = isTouch
    ? width <= PHONE_MAX || screenShortSide < PHONE_SHORT_SIDE
      ? 'phone'
      : width <= TABLET_MAX
        ? 'tablet'
        : 'desktop'
    : width <= MOUSE_PHONE_MAX
      ? 'phone'
      : width <= PHONE_MAX
        ? 'tablet'
        : 'desktop'
  return cached(layout, isTouch)
}

// Stable objects so useSyncExternalStore sees an unchanged snapshot when nothing changed.
const cache = new Map<string, Layout>()
function cached(layout: LayoutKind, isTouch: boolean): Layout {
  const key = `${layout}|${isTouch}`
  let v = cache.get(key)
  if (!v) cache.set(key, (v = Object.freeze({ layout, isTouch })))
  return v
}

const queries = [
  `(max-width: ${MOUSE_PHONE_MAX}px)`,
  `(max-width: ${PHONE_MAX}px)`,
  `(max-width: ${TABLET_MAX}px)`,
  '(pointer: coarse)',
]

export function getLayout(): Layout {
  return computeLayout(
    window.innerWidth,
    window.matchMedia('(pointer: coarse)').matches,
    Math.min(screen.width, screen.height),
  )
}

function subscribe(cb: () => void) {
  const lists = queries.map((q) => window.matchMedia(q))
  lists.forEach((m) => m.addEventListener('change', cb))
  return () => lists.forEach((m) => m.removeEventListener('change', cb))
}

/** Current layout; re-renders only when the layout class or touch mode changes. */
export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, getLayout)
}
