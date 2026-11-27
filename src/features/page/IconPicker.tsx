import { Upload } from 'lucide-react'
import { lazy, Suspense, useRef, useState } from 'react'
import { ws } from '@/core/docs/workspace'
import { t } from '@/core/i18n'
import { updateView, type IconValue } from '@/core/model/views'
import { useLayout } from '@/platform/layout'
import { Button, Overlay } from '@/ui'
import { uploadImage } from './uploadImage'
import { loadEmojiPicker } from '@/features/emoji'

const EmojiPicker = lazy(loadEmojiPicker)

/** Popover (desktop) / sheet (phone) to pick a view's icon: emoji, named icon or an uploaded image (ED-F12). */
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
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  return (
    <Overlay anchor={anchor} title={t('common.icon')} sheet={phone} onClose={onClose}>
      <div className="icon-upload">
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.currentTarget.files?.[0]
            e.currentTarget.value = ''
            if (!f) return
            setBusy(true)
            // icons are small: scaled to 256px, stored like any file (ED-F12, SY-04)
            void uploadImage(f, { maxSide: 256 }).then((id) => {
              setBusy(false)
              if (!id) return
              updateView(ws(), viewId, { icon: { type: 'file', value: id } })
              onClose()
            })
          }}
        />
        <Button size="sm" variant="ghost" icon={Upload} disabled={busy} onClick={() => input.current?.click()}>
          {busy ? t('files.loading') : t('icon.upload')}
        </Button>
      </div>
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
