import type { Editor as TEditor } from '@tiptap/react'
import { lazy, Suspense } from 'react'
import { t, type MessageKey } from '@/core/i18n'
import { useLayout } from '@/platform/layout'
import { Overlay } from '@/ui'
import { loadEmojiPicker } from '@/features/emoji'
import { CALLOUT_COLORS } from './nodes/callout'

const EmojiPicker = lazy(loadEmojiPicker)

/** Callout icon + background color picker (ED-B09). */
export function CalloutPicker({
  editor,
  pos,
  anchor,
  onClose,
}: {
  editor: TEditor
  pos: number
  anchor: HTMLElement
  onClose: () => void
}) {
  const phone = useLayout().layout === 'phone'
  const node = editor.state.doc.nodeAt(pos)
  if (node?.type.name !== 'callout') return null
  return (
    <Overlay anchor={anchor} title={t('block.callout')} sheet={phone} onClose={onClose}>
      <div className="callout-colors" role="radiogroup" aria-label={t('space.color')}>
        {CALLOUT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={node.attrs.color === c}
            aria-label={c === 'default' ? t('emoji.defaultColor') : t(`color.${c}` as MessageKey)}
            className={`callout-swatch${node.attrs.color === c ? ' is-selected' : ''}`}
            data-color={c}
            onClick={() => {
              editor.commands.updateCallout(pos, { color: c })
              onClose()
            }}
          />
        ))}
      </div>
      <Suspense fallback={null}>
        <EmojiPicker
          current={{ type: 'emoji', value: node.attrs.icon as string }}
          onPick={(icon) => {
            if (icon?.type === 'emoji') editor.commands.updateCallout(pos, { icon: icon.value })
            onClose()
          }}
        />
      </Suspense>
    </Overlay>
  )
}
