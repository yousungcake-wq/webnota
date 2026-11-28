import { X } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Button, IconButton } from '../Button'
import { Input } from '../controls'
import { uiStrings } from '../strings'
import { Dialog } from './Dialog'
import { dismissToast, hostStore, type ConfirmRequest, type ToastItem } from './host'
import './overlay.css'

/** Renders imperative overlays (confirm, toast) and the desktop tooltip. Mount once. */
export function OverlayHost() {
  const { confirms, toasts } = useSyncExternalStore(hostStore.subscribe, hostStore.get)
  return (
    <>
      {confirms.map((c) => (
        <Confirm key={c.id} req={c} />
      ))}
      {createPortal(
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <Toast key={t.id} item={t} />
          ))}
        </div>,
        document.body,
      )}
      <TooltipLayer />
    </>
  )
}

function Confirm({ req }: { req: ConfirmRequest }) {
  const [value, setValue] = useState(req.prompt?.value ?? '')
  const ok = () => req.resolve(true, req.prompt ? value : undefined)
  return (
    <Dialog
      role={req.prompt ? 'dialog' : 'alertdialog'}
      title={req.title}
      onClose={() => req.resolve(false)}
      actions={
        <>
          {!req.info && (
            <Button variant="ghost" onClick={() => req.resolve(false)}>
              {req.cancelLabel ?? uiStrings.cancel}
            </Button>
          )}
          <Button
            variant={req.danger ? 'danger' : 'primary'}
            {...(req.prompt ? {} : { 'data-autofocus': true })}
            onClick={ok}
          >
            {req.confirmLabel ?? uiStrings.ok}
          </Button>
        </>
      }
    >
      {req.message}
      {req.prompt && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            ok()
          }}
        >
          <Input
            label={req.prompt.label}
            value={value}
            data-autofocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setValue(e.target.value)}
          />
        </form>
      )}
    </Dialog>
  )
}

function Toast({ item }: { item: ToastItem }) {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => dismissToast(item.id), item.duration)
    return () => clearTimeout(timer)
  }, [item.id, item.duration, paused])
  return (
    <div
      className={`toast${item.tone === 'error' ? ' is-error' : ''}`}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <span className="toast-msg">{item.message}</span>
      {item.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            item.action!.onClick()
            dismissToast(item.id)
          }}
        >
          {item.action.label}
        </button>
      )}
      <IconButton size="sm" icon={X} label={uiStrings.dismiss} noTooltip onClick={() => dismissToast(item.id)} />
    </div>
  )
}

const DELAY_MS = 500

/**
 * One tooltip for the whole app: any element with `data-tooltip` gets it on hover or
 * keyboard focus. Desktop only — touch devices never show it (spec/12 §2).
 */
function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    let timer: ReturnType<typeof setTimeout> | undefined
    let current: HTMLElement | null = null
    const hide = () => {
      clearTimeout(timer)
      current = null
      setTip(null)
    }
    const show = (el: HTMLElement) => {
      if (el === current) return
      hide()
      current = el
      timer = setTimeout(() => {
        const text = el.dataset.tooltip
        if (!text || !el.isConnected) return
        const r = el.getBoundingClientRect()
        setTip({ text, top: r.bottom + 6, left: r.left + r.width / 2 })
      }, DELAY_MS)
    }
    const target = (e: Event) => (e.target instanceof Element ? e.target.closest<HTMLElement>('[data-tooltip]') : null)
    const onOver = (e: PointerEvent) => {
      if (!fine.matches || e.pointerType !== 'mouse') return
      const el = target(e)
      if (el) show(el)
      else if (current) hide()
    }
    const onFocus = (e: FocusEvent) => {
      const el = target(e)
      if (el && fine.matches && el.matches(':focus-visible')) show(el)
    }
    document.addEventListener('pointerover', onOver)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', hide)
    document.addEventListener('pointerdown', hide, true)
    window.addEventListener('scroll', hide, true)
    return () => {
      hide()
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('pointerdown', hide, true)
      window.removeEventListener('scroll', hide, true)
    }
  }, [])

  // Keep the bubble inside the viewport.
  useEffect(() => {
    const el = ref.current
    if (!el || !tip) return
    const w = el.offsetWidth
    const left = Math.max(8, Math.min(tip.left - w / 2, window.innerWidth - w - 8))
    el.style.left = `${left}px`
    if (tip.top + el.offsetHeight > window.innerHeight - 8) el.style.top = `${tip.top - el.offsetHeight - 40}px`
  }, [tip])

  if (!tip) return null
  return createPortal(
    <div ref={ref} className="tooltip" role="tooltip" style={{ top: tip.top, left: tip.left }}>
      {tip.text}
    </div>,
    document.body,
  )
}
