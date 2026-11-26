import { useSyncExternalStore } from 'react'

/**
 * Layout class (spec/08 §1, spec/12 §3). Screen size and input type are separate:
 * a touch tablet gets the wide layout with touch controls.
 *
 * | layout  | rule                       |
 * |---------|----------------------------|
 * | phone   | width < 768                |
 * | tablet  | 768 ≤ width < 1024 + touch |
 * | desktop | everything else            |
 */
export type LayoutKind = 'phone' | 'tablet' | 'desktop'
export interface Layout {
  layout: LayoutKind
  /** Primary pointer is coarse (finger): bigger targets, keyboard toolbar, sheets. */
  isTouch: boolean
}

export const PHONE_MAX = 767
export const TABLET_MAX = 1023

export function computeLayout(width: number, isTouch: boolean): Layout {
  const layout: LayoutKind = width <= PHONE_MAX ? 'phone' : width <= TABLET_MAX && isTouch ? 'tablet' : 'desktop'
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

const queries = [`(max-width: ${PHONE_MAX}px)`, `(max-width: ${TABLET_MAX}px)`, '(pointer: coarse)']

export function getLayout(): Layout {
  return computeLayout(window.innerWidth, window.matchMedia('(pointer: coarse)').matches)
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
