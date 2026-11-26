import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap, useLayer } from './hooks'

/** Centered modal dialog with a focus trap; Esc and the back button close it. */
export function Dialog({
  title,
  onClose,
  actions,
  role = 'dialog',
  children,
}: {
  title?: string
  onClose: () => void
  actions?: ReactNode
  role?: 'dialog' | 'alertdialog'
  children?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useLayer(onClose, { modal: true, history: true })
  useFocusTrap(ref)
  return createPortal(
    <div className="dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className="dialog"
      >
        {title && (
          <h2 id={titleId} className="dialog-title">
            {title}
          </h2>
        )}
        {children && <div className="dialog-body">{children}</div>}
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  )
}
