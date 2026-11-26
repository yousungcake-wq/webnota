import type { LucideIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMedia } from '@/platform/media'
import './menu.css'

export interface MenuItem {
  label: string
  icon?: LucideIcon
  danger?: boolean
  onSelect: () => void
}

/** Desktop: popover next to the anchor. Phones: bottom sheet (like AppFlowy mobile). */
export function Menu({
  anchor,
  title,
  items,
  onClose,
}: {
  anchor: HTMLElement | null
  title?: string
  items: MenuItem[]
  onClose: () => void
}) {
  const phone = useMedia('(max-width: 767px)')
  return (
    <Overlay anchor={anchor} title={title} onClose={onClose} sheet={phone}>
      <div className="menu-list" role="menu">
        {items.map((it) => {
          const Icon = it.icon
          return (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={`menu-item${it.danger ? ' is-danger' : ''}`}
              onClick={() => {
                onClose()
                it.onSelect()
              }}
            >
              {Icon && <Icon size={18} />}
              <span>{it.label}</span>
            </button>
          )
        })}
      </div>
    </Overlay>
  )
}

export function Overlay({
  anchor,
  title,
  onClose,
  sheet,
  children,
}: {
  anchor: HTMLElement | null
  title?: string
  onClose: () => void
  sheet: boolean
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (sheet || !anchor || !ref.current) return
    const r = anchor.getBoundingClientRect()
    const el = ref.current
    const w = el.offsetWidth
    const h = el.offsetHeight
    let top = r.bottom + 4
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
    setPos({ top, left })
  }, [anchor, sheet])

  // On phones, close the on-screen keyboard (and its toolbar) before showing a sheet.
  useEffect(() => {
    if (sheet && document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }, [sheet])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className={sheet ? 'sheet-backdrop' : 'popover-backdrop'}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        className={sheet ? 'sheet' : 'popover'}
        style={sheet ? undefined : { top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      >
        {sheet && <div className="sheet-grabber" aria-hidden />}
        {sheet && title && <div className="sheet-title">{title}</div>}
        {children}
      </div>
    </div>,
    document.body,
  )
}
