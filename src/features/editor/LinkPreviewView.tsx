import type { ReactNodeViewProps } from '@tiptap/react'
import { ExternalLink, Link2, RefreshCw, Trash2, Unlink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { t } from '@/core/i18n'
import { Button, IconButton, promptDialog, toast } from '@/ui'
import { fetchPreview, hostOf } from './linkPreview/unfurl'
import './linkPreview.css'

const isHttp = (s: string) => /^https?:\/\/\S+$/i.test(s)

/** Link preview card (ED-B21): fetches the page's metadata once, then shows the cached copy. */
export default function LinkPreviewView({
  node,
  updateAttributes,
  deleteNode,
  editor,
  selected,
  getPos,
}: ReactNodeViewProps) {
  const url = node.attrs.url as string | null
  const title = node.attrs.title as string
  const editable = editor.isEditable
  const [loading, setLoading] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  const refresh = (target: string) => {
    setLoading(true)
    void fetchPreview(target).then((meta) => {
      setLoading(false)
      if (!editor.isDestroyed) updateAttributes({ ...meta })
    })
  }

  // fetch once for a new card (empty title); other devices get the cached copy
  useEffect(() => {
    if (!url || title || !editable) return
    let alive = true
    void fetchPreview(url).then((meta) => alive && !editor.isDestroyed && updateAttributes({ ...meta }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the url changes
  }, [url])

  const askUrl = async () => {
    const v = await promptDialog({ title: t('linkPreview.link'), label: t('linkPreview.linkLabel'), value: url ?? '' })
    if (v === null) return
    const next = v.trim()
    if (!isHttp(next)) {
      toast(t('image.badLink'), { tone: 'error' })
      return
    }
    updateAttributes({ url: next, title: '', description: '', image: null, siteName: '' })
  }

  /** Back to a plain link in a paragraph. */
  const toLink = () => {
    const pos = getPos()
    if (typeof pos !== 'number' || !url) return
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: pos, to: pos + node.nodeSize },
        { type: 'paragraph', content: [{ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }] },
      )
      .run()
  }

  if (!url) {
    return (
      <div className="link-card is-empty" contentEditable={false}>
        <Link2 size={18} aria-hidden />
        {editable ? (
          <Button size="sm" icon={Link2} onClick={() => void askUrl()}>
            {t('linkPreview.link')}
          </Button>
        ) : (
          <span>{t('linkPreview.empty')}</span>
        )}
      </div>
    )
  }

  const image = node.attrs.image as string | null
  const site = (node.attrs.siteName as string) || hostOf(url)
  return (
    <div className="link-card-wrap" contentEditable={false}>
      <a className="link-card" href={url} target="_blank" rel="noreferrer noopener" draggable={false}>
        <span className="link-card-text">
          <span className="link-card-title">
            {(loading || !title) && editable ? t('files.loading') : title || hostOf(url)}
          </span>
          {node.attrs.description && <span className="link-card-desc">{node.attrs.description as string}</span>}
          <span className="link-card-site">{site}</span>
        </span>
        {image && !imgFailed && (
          <img
            className="link-card-image"
            src={image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        )}
      </a>
      {selected && editable && (
        <div className="link-card-toolbar" role="toolbar" aria-label={t('media.toolbar')}>
          <a
            className="icon-btn sm"
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={t('linkPreview.open')}
            data-tooltip={t('linkPreview.open')}
          >
            <ExternalLink size={16} />
          </a>
          <IconButton size="sm" icon={RefreshCw} label={t('linkPreview.refresh')} onClick={() => refresh(url)} />
          <IconButton size="sm" icon={Link2} label={t('media.changeLink')} onClick={() => void askUrl()} />
          <IconButton size="sm" icon={Unlink} label={t('linkPreview.toLink')} onClick={toLink} />
          <IconButton size="sm" icon={Trash2} tone="danger" label={t('media.delete')} onClick={deleteNode} />
        </div>
      )}
    </div>
  )
}
