import type { Editor as TEditor } from '@tiptap/react'
import { Film, Image as ImageIcon, Link2, MonitorPlay, PanelTop } from 'lucide-react'
import type { JSONContent } from '@tiptap/core'
import { t } from '@/core/i18n'
import { Menu, type MenuItem } from '@/ui'
import { embedSource, videoSource } from './nodes/embedUrls'

const IMAGE_URL = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i

/**
 * After a URL is pasted on its own line (ED-F06): keep the link, or turn the line into a
 * link preview, an embed, a video or an image block. Closing the menu keeps the link.
 */
export default function PasteUrlMenu({
  editor,
  url,
  pos,
  onClose,
}: {
  editor: TEditor
  url: string
  pos: number
  onClose: () => void
}) {
  const node = editor.state.doc.nodeAt(pos)
  const dom = editor.view.nodeDOM(pos)
  // the line must still be just this URL (it may have been edited or moved meanwhile)
  if (!node || node.type.name !== 'paragraph' || node.textContent !== url || !(dom instanceof HTMLElement)) return null

  const replace = (content: JSONContent) => () => {
    const at = editor.state.doc.nodeAt(pos)
    if (at?.textContent !== url) return
    editor
      .chain()
      .focus()
      .insertContentAt({ from: pos, to: pos + at.nodeSize }, [content, { type: 'paragraph' }])
      .run()
  }

  // a real player is offered as a video; any other page as an embed (feedback 2-2)
  const found = videoSource(url)
  const video = found && !(found.kind === 'iframe' && found.generic) ? found : null
  const embed = embedSource(url)
  const items: MenuItem[] = [
    { label: t('pasteUrl.link'), icon: Link2, onSelect: onClose },
    { label: t('pasteUrl.preview'), icon: PanelTop, onSelect: replace({ type: 'linkPreview', attrs: { url } }) },
  ]
  if (video)
    items.push({ label: t('pasteUrl.video'), icon: Film, onSelect: replace({ type: 'video', attrs: { src: url } }) })
  else if (embed && !IMAGE_URL.test(new URL(url).pathname))
    items.push({
      label: t('pasteUrl.embed'),
      icon: MonitorPlay,
      onSelect: replace({ type: 'embed', attrs: { src: url } }),
    })
  if (IMAGE_URL.test(new URL(url).pathname))
    items.push({
      label: t('pasteUrl.image'),
      icon: ImageIcon,
      onSelect: replace({ type: 'image', attrs: { src: url } }),
    })

  return <Menu anchor={dom} title={t('pasteUrl.title')} onClose={onClose} items={items} />
}
