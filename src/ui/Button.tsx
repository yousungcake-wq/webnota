import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './button.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  /** Stretch to the container width. */
  full?: boolean
  icon?: LucideIcon
  children?: ReactNode
}

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

export function Button({
  variant = 'secondary',
  size = 'md',
  full,
  icon: Icon,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('btn', variant !== 'secondary' && variant, size === 'sm' && 'sm', full && 'full', className)}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required: becomes aria-label and the desktop tooltip. */
  label: string
  icon: LucideIcon
  size?: 'sm' | 'md'
  /** Toggle state (aria-pressed). */
  active?: boolean
  tone?: 'default' | 'danger' | 'star'
  /** Hide the tooltip (e.g. when a visible label sits next to it). */
  noTooltip?: boolean
}

export function IconButton({
  label,
  icon: Icon,
  size = 'md',
  active,
  tone = 'default',
  noTooltip,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      data-tooltip={noTooltip ? undefined : label}
      aria-pressed={active}
      className={cx(
        'icon-btn',
        size === 'sm' && 'sm',
        tone === 'danger' && 'danger',
        tone === 'star' && active && 'is-fav',
        className,
      )}
      {...rest}
    >
      <Icon size={size === 'sm' ? 16 : 18} />
    </button>
  )
}
