import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Captions,
  Copy,
  Download,
  Eraser,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react'
import { use, useState } from 'react'
import { downloadFile } from '@/features/files'
import { IconButton, Menu, type MenuEntry } from '@/ui'
import { loadMediaMessages, mt } from './mediaI18n'
import type { MediaKey } from './mediaI18n/ko'
import './media.css'

const messages = loadMediaMessages()
type Align = 'left' | 'center' | 'right'
const ALIGN_ICON = { left: AlignLeft, center: AlignCenter, right: AlignRight }

/**
 * The toolbar of image and video blocks (feedback 4–5), floating at the media's top-left
 * corner (not between the media and its caption): align (+ size), caption, caption
 * alignment, download, clear (keep the block, empty), duplicate, delete.
 */
export function MediaToolbar({
  kind,
  attrs,
  update,
  sizes,
  download,
  fileId,
  onCaption,
  onClear,
  onDuplicate,
  onDelete,
}: {
  kind: 'image' | 'video'
  attrs: Record<string, unknown>
  update: (a: Record<string, unknown>) => void
  /** Width presets in % (null = original / full). */
  sizes: (number | null)[]
  download?: { href: string; name: string } | null
  /** A workspace file to download through the file cache (videos). */
  fileId?: string | null
  onCaption: () => void
  onClear: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  use(messages)
  const [menu, setMenu] = useState<{ which: 'align' | 'caption'; anchor: HTMLElement } | null>(null)
  const align = ((attrs.align as Align) || 'center') as Align
  const captionAlign = ((attrs.captionAlign as Align) || 'left') as Align
  const hasCaption = !!attrs.caption
  const alignItems = (key: 'align' | 'captionAlign', current: Align): MenuEntry[] =>
    (['left', 'center', 'right'] as const).map((a) => ({
      label: mt(`mt.${a}` as MediaKey),
      icon: ALIGN_ICON[a],
      checked: current === a,
      onSelect: () => update({ [key]: a }),
    }))
  const btn = (icon: typeof Copy, label: MediaKey, onClick: (e: React.MouseEvent<HTMLButtonElement>) => void) => (
    <IconButton size="sm" icon={icon} label={mt(label)} onClick={onClick} />
  )
  return (
    <div className="media-tools" role="toolbar" aria-label={mt('mt.toolbar')} contentEditable={false}>
      {btn(
        kind === 'image' ? ImageIcon : ALIGN_ICON[align],
        kind === 'image' ? 'mt.alignImage' : 'mt.alignVideo',
        (e) => setMenu({ which: 'align', anchor: e.currentTarget }),
      )}
      {btn(Captions, 'mt.caption', onCaption)}
      {hasCaption &&
        btn(ALIGN_ICON[captionAlign], 'mt.captionAlign', (e) => setMenu({ which: 'caption', anchor: e.currentTarget }))}
      {fileId
        ? btn(Download, 'mt.download', () => void downloadFile(fileId, fileId))
        : download && (
            <a
              className="icon-btn sm"
              href={download.href}
              download={download.name}
              aria-label={mt('mt.download')}
              data-tooltip={mt('mt.download')}
            >
              <Download size={16} />
            </a>
          )}
      {btn(Eraser, 'mt.clear', onClear)}
      {btn(Copy, 'mt.duplicate', onDuplicate)}
      <IconButton size="sm" icon={Trash2} tone="danger" label={mt('mt.delete')} onClick={onDelete} />
      {menu && (
        <Menu
          anchor={menu.anchor}
          title={
            menu.which === 'align' ? mt(kind === 'image' ? 'mt.alignImage' : 'mt.alignVideo') : mt('mt.captionAlign')
          }
          onClose={() => setMenu(null)}
          items={
            menu.which === 'align'
              ? [
                  ...alignItems('align', align),
                  'separator',
                  ...sizes.map((w) => ({
                    label: w ? `${mt('mt.size')} ${w}%` : mt('mt.sizeOriginal'),
                    checked: (attrs.width ?? null) === w,
                    onSelect: () => update({ width: w }),
                  })),
                ]
              : alignItems('captionAlign', captionAlign)
          }
        />
      )}
    </div>
  )
}

/** Caption under an image or video; its alignment is the block's `captionAlign`. */
export function MediaCaption({
  value,
  align,
  editable,
  autoFocus,
  onCommit,
}: {
  value: string
  align: string
  editable: boolean
  autoFocus: boolean
  onCommit: (v: string) => void
}) {
  use(messages)
  const [text, setText] = useState(value)
  const style = { textAlign: (align || 'left') as Align }
  if (!editable)
    return (
      <figcaption className="media-caption" style={style}>
        {value}
      </figcaption>
    )
  return (
    <figcaption className="media-caption" style={style}>
      <input
        value={text}
        placeholder={mt('mt.captionPlaceholder')}
        aria-label={mt('mt.caption')}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onCommit(text.trim())}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            e.currentTarget.blur()
          }
          if (e.key === 'Escape') {
            setText(value)
            e.currentTarget.blur()
          }
        }}
      />
    </figcaption>
  )
}
