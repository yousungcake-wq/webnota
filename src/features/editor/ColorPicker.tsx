import type { Editor as TEditor } from '@tiptap/react'
import { t, type MessageKey } from '@/core/i18n'
import { useLayout } from '@/platform/layout'
import { Overlay } from '@/ui'
import { PALETTE, colorAttrs, isPalette } from './nodes/colors'

/** Text + background color picker for the selection (ED-I03): 9 palette colors + default + custom. */
export function ColorPicker({
  editor,
  anchor,
  onClose,
}: {
  editor: TEditor
  anchor: HTMLElement | null
  onClose: () => void
}) {
  const phone = useLayout().layout === 'phone'
  const text = (editor.getAttributes('textStyle').color as string | undefined) ?? null
  const hl = editor.isActive('highlight')
    ? ((editor.getAttributes('highlight').color as string | null) ?? 'yellow')
    : null
  const apply = (kind: 'text' | 'bg', color: string | null) => {
    const chain = editor.chain().focus()
    if (kind === 'text') chain.setTextColor(color).run()
    else chain.setHighlightColor(color).run()
    onClose()
  }
  const row = (kind: 'text' | 'bg', current: string | null) => (
    <div className="color-row" role="radiogroup" aria-label={t(kind === 'text' ? 'color.text' : 'color.background')}>
      {[null, ...PALETTE].map((c) => {
        const name = c ? t(`color.${c}` as MessageKey) : t('emoji.defaultColor')
        return (
          <button
            key={c ?? 'default'}
            type="button"
            role="radio"
            aria-checked={current === c}
            aria-label={name}
            title={name}
            className={`color-swatch${current === c ? ' is-selected' : ''}`}
            {...colorAttrs(kind, c)}
            onClick={() => apply(kind, c)}
          >
            {kind === 'text' ? 'A' : null}
          </button>
        )
      })}
      <label className="color-swatch color-custom" title={t('color.custom')}>
        <input
          type="color"
          aria-label={t('color.custom')}
          defaultValue={current && !isPalette(current) ? current : '#888888'}
          // Native `change` fires once when the system picker closes (React's onChange is `input`).
          ref={(el) => {
            if (!el) return
            const onChange = () => apply(kind, el.value)
            el.addEventListener('change', onChange)
            return () => el.removeEventListener('change', onChange)
          }}
        />
      </label>
    </div>
  )
  return (
    <Overlay anchor={anchor} title={t('color.title')} sheet={phone} onClose={onClose}>
      <div className="color-picker">
        <div className="color-label">{t('color.text')}</div>
        {row('text', text)}
        <div className="color-label">{t('color.background')}</div>
        {row('bg', hl)}
      </div>
    </Overlay>
  )
}
