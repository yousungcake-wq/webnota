import type { Editor as TEditor } from '@tiptap/react'
import { Pin } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { t, type MessageKey } from '@/core/i18n'
import type { IconValue } from '@/core/model/views'
import { useLayout } from '@/platform/layout'
import { Overlay } from '@/ui'
import { loadEmojiPicker } from '@/features/emoji'
import { CALLOUT_COLORS, calloutIconFromValue, calloutIconValue } from './nodes/callout'

const EmojiPicker = lazy(loadEmojiPicker)

/**
 * Callout icon + background color picker (ED-B09). By default a pick closes it; "keep
 * open" (off each time it opens) keeps it open to try several (feedback 2-6). Emoji or a
 * named icon; "clear" leaves the callout without an icon.
 */
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
  const [pinned, setPinned] = useState(false)
  const [, redraw] = useState(0)
  const node = editor.state.doc.nodeAt(pos)
  if (node?.type.name !== 'callout') return null
  const done = () => {
    if (pinned)
      redraw((n) => n + 1) // show the new choice as selected
    else onClose()
  }
  const pin = (
    <button
      type="button"
      className={`callout-pin icon-btn sm${pinned ? ' is-on' : ''}`}
      aria-pressed={pinned}
      aria-label={t('emoji.pin')}
      data-tooltip={t('emoji.pin')}
      onClick={() => setPinned((p) => !p)}
    >
      <Pin size={16} />
    </button>
  )
  return (
    <Overlay anchor={anchor} title={t('block.callout')} sheet={phone} onClose={onClose}>
      <div className="callout-picker">
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
                done()
              }}
            />
          ))}
        </div>
        <Suspense fallback={null}>
          <EmojiPicker
            simple
            extra={pin}
            current={calloutIconFromValue(node.attrs.icon as string)}
            onPick={(icon: IconValue | null) => {
              editor.commands.updateCallout(pos, { icon: calloutIconValue(icon) })
              done()
            }}
          />
        </Suspense>
      </div>
    </Overlay>
  )
}
