import { ws } from '@/core/docs/workspace'
import { t } from '@/core/i18n'
import { updateView, type IconValue } from '@/core/model/views'
import { useLayout } from '@/platform/layout'
import { Button, Overlay } from '@/ui'
import { emoji } from './ViewIcon'

const EMOJIS = '📄📝📌📎📚📖🗂️📁🗓️✅☑️💡🔥⭐️🎯🚀🧠💼🏠🛒✈️🍳🎵🎮📷🎨🧪💻🔧📊📈💰❤️🌱☕️🐶😀👋🙌🎉'
let emojiList: string[] | null = null

/** Popover (desktop) / sheet (phone) to pick a view's icon. Replaced by the full EmojiPicker in M1-14. */
export function IconPicker({
  anchor,
  viewId,
  current,
  onClose,
}: {
  anchor: HTMLElement | null
  viewId: string
  current: IconValue | null
  onClose: () => void
}) {
  const phone = useLayout().layout === 'phone'
  emojiList ??= Array.from(new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(EMOJIS), (s) => s.segment)
  const set = (icon: IconValue | null) => {
    updateView(ws(), viewId, { icon })
    onClose()
  }
  return (
    <Overlay anchor={anchor} title={t('common.icon')} sheet={phone} onClose={onClose}>
      <div className="emoji-grid">
        {emojiList.map((em) => (
          <button key={em} type="button" className="emoji-btn" onClick={() => set(emoji(em))}>
            {em}
          </button>
        ))}
      </div>
      {current && (
        <Button variant="ghost" full onClick={() => set(null)}>
          {t('page.removeIcon')}
        </Button>
      )}
    </Overlay>
  )
}
