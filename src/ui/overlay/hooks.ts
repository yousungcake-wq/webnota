import { useEffect, useRef, type RefObject } from 'react'
import { registerLayer, type LayerOptions } from './stack'

/** Registers the calling overlay as a layer while mounted. `onClose` may change between renders. */
export function useLayer(onClose: () => void, opts: LayerOptions = {}) {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  const { modal, history } = opts
  useEffect(() => {
    const h = registerLayer(() => closeRef.current(), { modal, history })
    return () => h.release()
  }, [modal, history])
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Keeps Tab inside `ref` while mounted, focuses `[data-autofocus]` / the first
 * focusable element (or the container) on open, and restores focus on close.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, { restore = true, autoFocus = true } = {}) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (autoFocus) {
      const target = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el
      target.focus({ preventScroll: true })
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null)
      if (!items.length) {
        e.preventDefault()
        return
      }
      const first = items[0]!
      const last = items[items.length - 1]!
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) {
        e.preventDefault()
        first.focus()
      }
    }
    el.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('keydown', onKey)
      if (restore && previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [ref, restore, autoFocus])
}
