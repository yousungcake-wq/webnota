import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap, useLayer } from './hooks'

/** Drag distance that closes the sheet or changes its height step. */
const SNAP_PX = 64
/** Default step: content-sized up to this share of the screen; full leaves a gap at the top. */
const AUTO = 0.85
const FULL_GAP = 40

export type SheetSize = 'auto' | 'full'

const isTyping = (el: Element | null) =>
  !!el && (el.matches('input, textarea, select') || (el as HTMLElement).isContentEditable)

/**
 * Bottom sheet (phones, MB-10, M7-01). Two height steps: auto (content-sized up to 85% of
 * the screen, so menus open whole) and full. Dragging the handle — or the content while it
 * is scrolled to the top — moves the sheet: down from full goes to auto, down from auto
 * closes, up from auto goes to full (only when the content does not fit). A tap on the handle toggles the steps.
 * The step heights come from the screen height without the keyboard, and while typing the
 * sheet keeps the height it had, so the on-screen keyboard does not make it jump; it only
 * shrinks when it would not fit above the keyboard. Opening closes the keyboard; the back
 * button closes it (MB-14).
 */
export function Sheet({
  title,
  onClose,
  label,
  size = 'auto',
  children,
}: {
  title?: string
  onClose: () => void
  label?: string
  /** Starting height step; panels that grow while used start full. */
  size?: SheetSize
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(size === 'full')
  const [dy, setDy] = useState<number | null>(null)
  // screen height without the keyboard, and the sheet height kept while typing
  const [base, setBase] = useState(() => window.innerHeight)
  const [lock, setLock] = useState<number | null>(null)
  useLayer(onClose, { modal: true, history: true })
  useFocusTrap(ref, { restore: false, autoFocus: false })

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    ref.current?.focus({ preventScroll: true })
  }, [])

  // rotation and split screen change the steps; the keyboard does not
  useEffect(() => {
    const onResize = () => {
      if (!isTyping(document.activeElement)) setBase(window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const fits = () => {
    const el = ref.current
    return !el || el.scrollHeight <= el.clientHeight + 1
  }
  /** End of a drag of `d` px (positive: down). */
  const settle = (d: number) => {
    setDy(null)
    if (d > SNAP_PX) {
      // a long fling from full closes at once
      if (full && d < (ref.current?.offsetHeight ?? 0) / 2) setFull(false)
      else onClose()
    } else if (d < -SNAP_PX && !full && !fits()) setFull(true)
  }

  // drags live in a small lazy module (start bundle budget); it is cached after one sheet
  const latest = useRef({ full, settle, fits })
  useEffect(() => {
    latest.current = { full, settle, fits }
  })
  useEffect(() => {
    let off: (() => void) | undefined
    let alive = true
    void import('./sheetGestures').then(({ attachSheetGestures }) => {
      if (!alive || !ref.current) return
      off = attachSheetGestures(ref.current, {
        full: () => latest.current.full,
        fits: () => latest.current.fits(),
        setDy,
        settle: (d) => latest.current.settle(d),
        toggle: () => {
          if (latest.current.full) setFull(false)
          else if (!latest.current.fits()) setFull(true)
        },
      })
    })
    return () => {
      alive = false
      off?.()
    }
  }, [])

  // typing keeps the current height (the keyboard opening must not resize the sheet)
  const onFocus = (e: React.FocusEvent) => {
    if (isTyping(e.target) && lock == null && ref.current) setLock(ref.current.offsetHeight)
  }
  const onBlur = (e: React.FocusEvent) => {
    if (!isTyping(e.relatedTarget as Element | null)) setLock(null)
  }

  const max = full ? base - FULL_GAP : Math.round(base * AUTO)
  // dragging up from auto previews the growth; down moves the whole sheet
  const offset = dy == null ? 0 : dy > 0 ? dy : full ? Math.max(dy, -16) / 4 : 0
  const grow = dy != null && dy < 0 && !full ? Math.min(-dy, base - FULL_GAP - max) : 0
  const style = {
    '--sheet-max': `${max + grow}px`,
    ...(full ? { height: `${max}px` } : lock != null ? { height: `${lock}px` } : grow ? { minHeight: 0 } : null),
    ...(dy != null ? { transform: `translateY(${offset}px)`, transition: 'none' } : null),
  } as unknown as React.CSSProperties

  return createPortal(
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title}
        tabIndex={-1}
        className="sheet"
        data-size={full ? 'full' : 'auto'}
        style={style}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <div className="sheet-handle">
          <div className="sheet-grabber" aria-hidden />
          {title && <div className="sheet-title">{title}</div>}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
