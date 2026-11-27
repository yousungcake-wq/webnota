import { useLayoutEffect, useRef, useState } from 'react'
import type { FieldMeta } from '@/core/model/database'
import { dt } from './i18n'

/**
 * In-place text editor over a cell (desktop). Enter saves (Shift+Enter: new line in text),
 * Esc cancels, leaving the cell saves. Number fields get the decimal keypad on touch.
 */
export function CellEditor({
  field,
  initial,
  onDone,
}: {
  field: FieldMeta
  initial: string
  /** `text` to save, or null to cancel; `move` is where the active cell goes next. */
  onDone: (text: string | null, move?: 'down' | 'right' | 'left') => void
}) {
  const [text, setText] = useState(initial)
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null)
  const done = useRef(false)
  const finish = (v: string | null, move?: 'down' | 'right' | 'left') => {
    if (done.current) return
    done.current = true
    onDone(v, move)
  }
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || el.tagName !== 'TEXTAREA') return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const common = {
    className: 'dbc-editor',
    'aria-label': dt('db.cell.edit'),
    value: text,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setText(e.target.value),
    onBlur: () => finish(text),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.nativeEvent.isComposing) return
      e.stopPropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        finish(null)
      } else if (e.key === 'Enter' && !(e.shiftKey && field.type === 'text')) {
        e.preventDefault()
        finish(text, 'down')
      } else if (e.key === 'Tab') {
        e.preventDefault()
        finish(text, e.shiftKey ? 'left' : 'right')
      }
    },
  }
  return field.type === 'text' ? (
    <textarea ref={ref} rows={1} {...common} />
  ) : (
    <input
      ref={ref}
      {...common}
      type={field.type === 'url' ? 'url' : 'text'}
      inputMode={field.type === 'number' ? 'decimal' : field.type === 'url' ? 'url' : undefined}
    />
  )
}
