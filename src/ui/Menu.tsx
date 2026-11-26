import { Check, ChevronRight, type LucideIcon } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { useLayout } from '@/platform/layout'
import { Overlay } from './overlay/Overlay'
import './menu.css'

export interface MenuItem {
  label: string
  icon?: LucideIcon
  danger?: boolean
  disabled?: boolean
  /** Shows a check mark (single/multi choice menus). */
  checked?: boolean
  /** Display-only shortcut hint, e.g. "⌘D". Hidden on phones. */
  shortcut?: string
  /** Opens a submenu instead of running onSelect. */
  children?: MenuEntry[]
  onSelect?: () => void
}
export type MenuEntry = MenuItem | 'separator'

/**
 * Desktop: popover next to the anchor. Phones: bottom sheet (like AppFlowy mobile).
 * Keyboard: ↑/↓/Home/End move, Enter/Space select, → opens a submenu, ←/Esc closes it.
 */
export function Menu({
  anchor,
  title,
  items,
  onClose,
  onDone,
  placement,
}: {
  anchor: HTMLElement | null
  title?: string
  items: MenuEntry[]
  onClose: () => void
  /** Called instead of onClose after an item is chosen (a submenu closes its parents too). */
  onDone?: () => void
  placement?: 'bottom-start' | 'right-start'
}) {
  const phone = useLayout().layout === 'phone'
  const listRef = useRef<HTMLDivElement>(null)
  const [sub, setSub] = useState<{ item: MenuItem; anchor: HTMLElement } | null>(null)

  const buttons = () => [
    ...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') ?? []),
  ]
  const move = (delta: number | 'first' | 'last') => {
    const all = buttons()
    if (!all.length) return
    const i = all.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      delta === 'first' ? 0 : delta === 'last' ? all.length - 1 : (i + (delta as number) + all.length) % all.length
    all[next]!.focus()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Home: () => move('first'),
      End: () => move('last'),
      ArrowLeft: () => placement === 'right-start' && onClose(),
    }
    const fn = keys[e.key]
    if (fn) {
      e.preventDefault()
      fn()
    }
  }

  const activate = (it: MenuItem, el: HTMLElement) => {
    if (it.children) {
      setSub({ item: it, anchor: el })
      return
    }
    ;(onDone ?? onClose)()
    it.onSelect?.()
  }

  return (
    <>
      <Overlay anchor={anchor} title={title} onClose={onClose} sheet={phone} placement={placement}>
        <div ref={listRef} className="menu-list" role="menu" aria-label={title} onKeyDown={onKeyDown}>
          {items.map((it, i) => {
            if (it === 'separator') return <div key={`sep-${i}`} className="menu-sep" role="separator" />
            const Icon = it.icon
            return (
              <button
                key={it.label}
                type="button"
                role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                aria-checked={it.checked}
                aria-haspopup={it.children ? 'menu' : undefined}
                disabled={it.disabled}
                className={`menu-item${it.danger ? ' is-danger' : ''}`}
                onClick={(e) => activate(it, e.currentTarget)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' && it.children) {
                    e.preventDefault()
                    activate(it, e.currentTarget)
                  }
                }}
              >
                {Icon && <Icon size={18} />}
                <span className="menu-label">{it.label}</span>
                {it.shortcut && !phone && <kbd className="menu-shortcut">{it.shortcut}</kbd>}
                {it.checked && <Check size={16} className="menu-check" />}
                {it.children && <ChevronRight size={16} className="menu-chevron" />}
              </button>
            )
          })}
        </div>
      </Overlay>
      {sub && (
        <Menu
          anchor={sub.anchor}
          title={sub.item.label}
          items={sub.item.children!}
          placement="right-start"
          onDone={() => {
            setSub(null)
            ;(onDone ?? onClose)()
          }}
          onClose={() => {
            setSub(null)
            sub.anchor.focus()
          }}
        />
      )}
    </>
  )
}
