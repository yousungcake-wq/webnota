import { lazy, Suspense } from 'react'
import { ws } from '@/core/docs/workspace'
import { t } from '@/core/i18n'
import { updateView, type IconValue } from '@/core/model/views'
import { useLayout } from '@/platform/layout'
import { Overlay } from '@/ui'
import { loadEmojiPicker } from '@/features/emoji'

const EmojiPicker = lazy(loadEmojiPicker)

/** Popover (desktop) / sheet (phone) to pick a view's icon (ED-F12). */
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
  return (
    <Overlay anchor={anchor} title={t('common.icon')} sheet={phone} onClose={onClose}>
      <Suspense fallback={<div className="emoji-loading" />}>
        <EmojiPicker
          current={current}
          onPick={(icon) => {
            updateView(ws(), viewId, { icon })
            onClose()
          }}
        />
      </Suspense>
    </Overlay>
  )
}
