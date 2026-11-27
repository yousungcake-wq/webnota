import type { ReactNodeViewProps } from '@tiptap/react'
import { ExternalLink, Film, Link2, Maximize2, MonitorPlay, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { t } from '@/core/i18n'
import { fileStatusKey, useFile } from '@/features/files'
import { Button, IconButton, Menu, promptDialog, toast } from '@/ui'
import { embedSource, videoSource } from './nodes/embedUrls'
import { MediaCaption, MediaToolbar } from './MediaToolbar'
import './embed.css'

/** iframe permissions: players need scripts + their own origin; no top navigation. */
const SANDBOX =
  'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-forms'
const ALLOW = 'fullscreen; picture-in-picture; encrypted-media; clipboard-write; autoplay'

export default function EmbedView({
  node,
  updateAttributes,
  deleteNode,
  editor,
  selected,
  getPos,
}: ReactNodeViewProps) {
  const isVideo = node.type.name === 'video'
  const src = node.attrs.src as string | null
  const editable = editor.isEditable
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [editingCaption, setEditingCaption] = useState(false)

  const askLink = async () => {
    const url = await promptDialog({
      title: t(isVideo ? 'video.link' : 'embed.link'),
      label: t(isVideo ? 'video.linkLabel' : 'embed.linkLabel'),
      value: src && !/^[0-9a-f]{64}\./.test(src) ? src : '',
    })
    if (url === null) return
    const v = url.trim()
    if (!(isVideo ? videoSource(v) : embedSource(v))) {
      toast(t(isVideo ? 'video.unsupported' : 'embed.unsupported'), { tone: 'error' })
      return
    }
    updateAttributes({ src: v })
  }

  const fileInput = isVideo && (
    <input
      ref={input}
      type="file"
      accept="video/mp4,video/webm,video/quicktime"
      hidden
      onChange={(e) => {
        const f = e.currentTarget.files?.[0]
        e.currentTarget.value = ''
        if (!f) return
        setBusy(true)
        void import('@/core/files/ingest').then(async (m) => {
          try {
            const ref = await m.addFile(f, f.name)
            if (videoSource(ref.id)) updateAttributes({ src: ref.id })
            else toast(t('video.unsupported'), { tone: 'error' })
          } catch (err) {
            toast(err instanceof m.FileTooLargeError ? t('files.tooLarge', { max: m.MAX_FILE_MB }) : t('files.error'), {
              tone: 'error',
            })
          } finally {
            setBusy(false)
          }
        })
      }}
    />
  )

  if (!src) {
    return (
      <div className="media-empty" contentEditable={false}>
        {fileInput}
        {isVideo ? <Film size={20} aria-hidden /> : <MonitorPlay size={20} aria-hidden />}
        {busy ? (
          <span role="status">{t('upload.processing', { name: '' })}</span>
        ) : editable ? (
          <>
            <Button size="sm" icon={Link2} onClick={() => void askLink()}>
              {t(isVideo ? 'video.link' : 'embed.link')}
            </Button>
            {isVideo && (
              <Button size="sm" variant="ghost" icon={Upload} onClick={() => input.current?.click()}>
                {t('video.upload')}
              </Button>
            )}
            {!isVideo && <span className="media-hint">{t('embed.hint')}</span>}
          </>
        ) : (
          <span>{t(isVideo ? 'video.empty' : 'embed.empty')}</span>
        )}
      </div>
    )
  }

  const width = node.attrs.width as number | null
  const height = node.attrs.height as number | null
  const video = isVideo ? videoSource(src) : null
  const embed = isVideo ? null : embedSource(src)

  let body
  if (video?.kind === 'file') body = <VideoFile src={video.src} />
  else if (video?.kind === 'iframe' || embed) {
    const frameSrc = video?.kind === 'iframe' ? video.src : embed!.src
    body = (
      <div
        className={`media-frame${isVideo ? ' is-video' : ''}`}
        style={isVideo ? undefined : { height: height ?? embed!.height }}
      >
        <iframe
          src={frameSrc}
          title={t(isVideo ? 'video.title' : 'embed.title')}
          loading="lazy"
          sandbox={SANDBOX}
          allow={ALLOW}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        {/* until selected, a click selects the block instead of going into the iframe */}
        {editable && !selected && <div className="media-shield" />}
      </div>
    )
  } else body = <div className="media-empty">{t(isVideo ? 'video.unsupported' : 'embed.unsupported')}</div>

  if (isVideo) {
    const caption = (node.attrs.caption as string) ?? ''
    const showCaption = editingCaption || !!caption
    const fileSrc = video?.kind === 'file' && !/^https?:/i.test(src) ? src : null
    return (
      <figure className="media-figure" contentEditable={false}>
        <div className="media-box" style={{ width: width ? `${width}%` : '100%' }}>
          {body}
          {editable && (
            <MediaToolbar
              kind="video"
              attrs={node.attrs}
              update={updateAttributes}
              sizes={[50, 75, null]}
              download={fileSrc ? { href: '', name: '' } : null}
              fileId={fileSrc}
              onCaption={() => setEditingCaption(true)}
              onClear={() => updateAttributes({ src: null })}
              onDuplicate={() => {
                const pos = getPos()
                if (typeof pos === 'number')
                  editor
                    .chain()
                    .insertContentAt(pos + node.nodeSize, node.toJSON())
                    .run()
              }}
              onDelete={deleteNode}
            />
          )}
        </div>
        {showCaption && (
          <MediaCaption
            value={caption}
            align={node.attrs.captionAlign as string}
            editable={editable}
            autoFocus={editingCaption}
            onCommit={(v) => {
              setEditingCaption(false)
              if (v !== caption) updateAttributes({ caption: v })
            }}
          />
        )}
      </figure>
    )
  }

  return (
    <figure className="media-figure" contentEditable={false}>
      {body}
      {selected && editable && (
        <div className="media-toolbar" role="toolbar" aria-label={t('media.toolbar')}>
          <IconButton size="sm" icon={Link2} label={t('media.changeLink')} onClick={() => void askLink()} />
          <IconButton size="sm" icon={Maximize2} label={t('image.size')} onClick={(e) => setMenu(e.currentTarget)} />
          {/^https:/i.test(src) && (
            <a
              className="icon-btn sm"
              href={src}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t('image.open')}
              data-tooltip={t('image.open')}
            >
              <ExternalLink size={16} />
            </a>
          )}
          <IconButton size="sm" icon={Trash2} tone="danger" label={t('media.delete')} onClick={deleteNode} />
          {menu && (
            <Menu
              anchor={menu}
              title={t('image.size')}
              onClose={() => setMenu(null)}
              items={
                isVideo
                  ? [50, 75, 100].map((w) => ({
                      label: `${w}%`,
                      checked: (width ?? 100) === w,
                      onSelect: () => updateAttributes({ width: w === 100 ? null : w }),
                    }))
                  : (
                      [
                        ['media.small', 300],
                        ['media.medium', null],
                        ['media.large', 640],
                      ] as const
                    ).map(([key, h]) => ({
                      label: t(key),
                      checked: height === h,
                      onSelect: () => updateAttributes({ height: h }),
                    }))
              }
            />
          )}
        </div>
      )}
    </figure>
  )
}

function VideoFile({ src }: { src: string }) {
  const isUrl = /^https?:/i.test(src)
  const file = useFile(isUrl ? null : src)
  const url = isUrl ? src : file.url
  if (!url)
    return (
      <div className="media-frame is-video is-placeholder" role="status">
        {t(fileStatusKey(file.status))}
      </div>
    )
  return <video className="media-video" src={url} controls preload="metadata" playsInline />
}
