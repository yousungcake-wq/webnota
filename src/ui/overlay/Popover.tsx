import { useLayoutEffect, useRef, useState, type ReactNode, type WheelEvent } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap, useLayer } from './hooks'

export type Placement = 'bottom-start' | 'right-start'

/**
 * The wheel over the backdrop scrolls what is under it (the page), so an open popover does
 * not freeze the page (feedback 2-6).
 */
function passWheel(e: WheelEvent<HTMLDivElement>) {
  if (e.target !== e.currentTarget) return
  const backdrop = e.currentTarget
  backdrop.style.pointerEvents = 'none'
  const under = document.elementFromPoint(e.clientX, e.clientY)
  backdrop.style.pointerEvents = ''
  for (let el = under as HTMLElement | null; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el)
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      el.scrollBy({ top: e.deltaY, left: e.deltaX })
      return
    }
  }
  document.scrollingElement?.scrollBy({ top: e.deltaY, left: e.deltaX })
}

/** Floating panel next to `anchor` (desktop). Closes on outside press and Esc. */
export function Popover({
  anchor,
  onClose,
  placement = 'bottom-start',
  label,
  className,
  children,
}: {
  anchor: HTMLElement | null
  onClose: () => void
  placement?: Placement
  label?: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useLayer(onClose, { modal: true })
  useFocusTrap(ref)

  const [scrolled, setScrolled] = useState(0)
  // follows its anchor when the page scrolls under it
  useLayoutEffect(() => {
    const on = () => setScrolled((n) => n + 1)
    window.addEventListener('scroll', on, true)
    return () => window.removeEventListener('scroll', on, true)
  }, [])
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return
    const r = anchor.getBoundingClientRect()
    const { offsetWidth: w, offsetHeight: h } = ref.current
    let top: number
    let left: number
    if (placement === 'right-start') {
      top = r.top - 6
      left = r.right + 4
      if (left + w > window.innerWidth - 8) left = r.left - w - 4
    } else {
      top = r.bottom + 4
      left = r.left
      if (top + h > window.innerHeight - 8) top = r.top - h - 4
    }
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8))
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
    setPos({ top, left })
  }, [anchor, placement, scrolled])

  return createPortal(
    <div
      className="popover-backdrop"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      onWheel={passWheel}
    >
      <div
        ref={ref}
        role="dialog"
        aria-label={label}
        tabIndex={-1}
        className={`popover${className ? ` ${className}` : ''}`}
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
