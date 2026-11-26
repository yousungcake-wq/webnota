import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap, useLayer } from './hooks'

const DISMISS_PX = 80

/**
 * Bottom sheet (phones, MB-10). Closes the on-screen keyboard when it opens, can be
 * dragged down by its handle to close, and the back button closes it (MB-14).
 */
export function Sheet({
  title,
  onClose,
  label,
  children,
}: {
  title?: string
  onClose: () => void
  label?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ start: number; dy: number } | null>(null)
  useLayer(onClose, { modal: true, history: true })
  useFocusTrap(ref, { restore: false, autoFocus: false })

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    ref.current?.focus({ preventScroll: true })
  }, [])

  const handle = {
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      setDrag({ start: e.clientY, dy: 0 })
    },
    onPointerMove: (e: React.PointerEvent) => drag && setDrag({ ...drag, dy: Math.max(0, e.clientY - drag.start) }),
    onPointerUp: () => {
      if (drag && drag.dy > DISMISS_PX) onClose()
      setDrag(null)
    },
    onPointerCancel: () => setDrag(null),
  }

  return createPortal(
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title}
        tabIndex={-1}
        className="sheet"
        style={drag ? { transform: `translateY(${drag.dy}px)`, transition: 'none' } : undefined}
      >
        <div className="sheet-handle" {...handle}>
          <div className="sheet-grabber" aria-hidden />
          {title && <div className="sheet-title">{title}</div>}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
