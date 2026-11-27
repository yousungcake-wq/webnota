import { Check, type LucideIcon } from 'lucide-react'
import { useId, useRef, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
import './controls.css'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: ReactNode
  error?: string
}

/** Labelled text field. Font size stays 16px so iOS does not zoom on focus. */
export function Input({ label, hint, error, id, className, ...rest }: InputProps) {
  const auto = useId()
  const inputId = id ?? auto
  const hintId = hint || error ? `${inputId}-hint` : undefined
  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <input id={inputId} aria-invalid={error ? true : undefined} aria-describedby={hintId} {...rest} />
      {(error || hint) && (
        <span id={hintId} className={error ? 'field-error' : 'field-hint'}>
          {error ?? hint}
        </span>
      )}
    </div>
  )
}

/** On/off toggle (role="switch"). The whole row is the touch target. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="switch-row"
      onClick={() => onChange(!checked)}
    >
      <span className="switch-text">
        <span>{label}</span>
        {description && <span className="switch-desc">{description}</span>}
      </span>
      <span className={`switch${checked ? ' is-on' : ''}`} aria-hidden>
        <span className="switch-thumb" />
      </span>
    </button>
  )
}

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
  /** BCP 47 language of the label, when it differs from the UI language. */
  lang?: string
}

/** Single choice from 2–4 options (radiogroup; ←/→ move the selection). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onKeyDown = (e: KeyboardEvent) => {
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const i = options.findIndex((o) => o.value === value)
    const next = options[(i + delta + options.length) % options.length]!
    onChange(next.value)
    ref.current?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus()
  }
  return (
    <div ref={ref} className="segmented" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map(({ value: v, label: l, icon: Icon, lang }) => (
        <button
          key={v}
          type="button"
          role="radio"
          data-value={v}
          lang={lang}
          aria-checked={value === v}
          tabIndex={value === v ? 0 : -1}
          className={value === v ? 'is-on' : ''}
          onClick={() => onChange(v)}
        >
          {value === v ? <Check size={16} aria-hidden /> : Icon && <Icon size={16} />} {l}
        </button>
      ))}
    </div>
  )
}

/** Loading placeholder lines. */
export function Skeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={`skeleton${className ? ` ${className}` : ''}`} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton-line" style={{ width: i === lines - 1 ? '60%' : undefined }} />
      ))}
    </div>
  )
}

/** Centered message for empty or missing content, with an optional action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={32} className="empty-icon" />}
      <p>{title}</p>
      {description && <p className="muted">{description}</p>}
      {action}
    </div>
  )
}
