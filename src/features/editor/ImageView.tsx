import type { ReactNodeViewProps } from '@tiptap/react'
import { ImagePlus, Link2, RefreshCw, Upload } from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { t } from '@/core/i18n'
import { fileStatusKey, useFile } from '@/features/files'
import { useLayout } from '@/platform/layout'
import { Button, promptDialog, toast } from '@/ui'
import { imageBoxStyle } from './ImageBlock'
import { MediaCaption, MediaToolbar } from './MediaToolbar'
import { isImageSrc, type ImageAlign } from './nodes/image'
import './image.css'

const loadIngest = () => import('@/core/files/ingest')
const isFile = (src: string) => !/^https?:/i.test(src)

/** Picks a file, stores it (SY-04) and calls `done` with the new attributes. */
function pickImage(input: HTMLInputElement | null) {
  input?.click()
}

async function store(file: File) {
  const m = await loadIngest()
  try {
    const ref = await m.ingestFile(file)
    return { src: ref.id, naturalWidth: ref.width ?? null, naturalHeight: ref.height ?? null }
  } catch (e) {
    toast(e instanceof m.FileTooLargeError ? t('files.tooLarge', { max: m.MAX_FILE_MB }) : t('files.error'), {
      tone: 'error',
    })
    return null
  }
}

async function askUrl(current = '') {
  const url = await promptDialog({ title: t('image.link'), label: t('image.linkLabel'), value: current })
  if (url === null) return null
  const v = url.trim()
  if (!isImageSrc(v) || !/^https?:/i.test(v)) {
    toast(t('image.badLink'), { tone: 'error' })
    return null
  }
  return v
}

export default function ImageView({ node, updateAttributes, deleteNode, editor, getPos }: ReactNodeViewProps) {
  const src = node.attrs.src as string | null
  const editable = editor.isEditable
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const onPicked = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setBusy(true)
    const attrs = await store(file)
    setBusy(false)
    if (attrs) updateAttributes({ ...attrs, width: null })
  }

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => {
        void onPicked(e.currentTarget.files)
        e.currentTarget.value = ''
      }}
    />
  )

  if (!src) {
    return (
      <div className="image-empty" contentEditable={false}>
        {fileInput}
        <ImagePlus size={20} aria-hidden />
        {busy ? (
          <span role="status">{t('upload.processing', { name: '' })}</span>
        ) : editable ? (
          <>
            <Button size="sm" icon={Upload} onClick={() => pickImage(input.current)}>
              {t('image.upload')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={Link2}
              onClick={() => void askUrl().then((url) => url && updateAttributes({ src: url, width: null }))}
            >
              {t('image.link')}
            </Button>
          </>
        ) : (
          <span>{t('image.empty')}</span>
        )}
      </div>
    )
  }

  return (
    <>
      {fileInput}
      <Figure
        src={src}
        attrs={node.attrs}
        editable={editable}
        updateAttributes={updateAttributes}
        onClear={() => updateAttributes({ src: null, width: null, naturalWidth: null, naturalHeight: null })}
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
    </>
  )
}

function Figure({
  src,
  attrs,
  editable,
  updateAttributes,
  onClear,
  onDuplicate,
  onDelete,
}: {
  src: string
  attrs: Record<string, unknown>
  editable: boolean
  updateAttributes: (a: Record<string, unknown>) => void
  onClear: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const file = useFile(isFile(src) ? src : null)
  const url = isFile(src) ? file.url : src
  const status = isFile(src) ? file.status : 'ready'
  const caption = attrs.caption as string
  const [editingCaption, setEditingCaption] = useState(false)
  const [drag, setDrag] = useState<number | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const phone = useLayout().layout === 'phone'
  const [failed, setFailed] = useState(false)

  const box = imageBoxStyle(attrs)
  const style = drag !== null ? { ...box, width: `${drag}%` } : box

  /** Drag a side handle: width as a percent of the text column (10–100). */
  const startResize = (e: ReactPointerEvent, side: 1 | -1) => {
    const el = frame.current
    const column = el?.parentElement?.parentElement
    if (!el || !column) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = el.getBoundingClientRect().width
    const full = column.getBoundingClientRect().width
    // a centered image grows on both sides
    const k = (attrs.align as ImageAlign) === 'center' ? 2 : 1
    let pct = (startW / full) * 100
    const move = (ev: PointerEvent) => {
      const w = startW + (ev.clientX - startX) * side * k
      pct = Math.round(Math.min(100, Math.max(10, (w / full) * 100)))
      setDrag(pct)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      updateAttributes({ width: pct })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const showCaption = editingCaption || !!caption
  return (
    <figure className="image-figure" contentEditable={false}>
      <div className="media-box" style={style}>
        <div ref={frame} className={`image-frame${url && !failed ? '' : ' is-placeholder'}`}>
          {url && !failed ? (
            <img
              src={url}
              alt={caption}
              loading="lazy"
              decoding="async"
              draggable={false}
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
              onLoad={(e) => {
                const img = e.currentTarget
                if (editable && !attrs.naturalWidth && img.naturalWidth)
                  updateAttributes({ naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight })
              }}
            />
          ) : (
            <div className="image-status" role="status">
              <span>{failed ? t('files.error') : t(fileStatusKey(status))}</span>
              {(failed || status === 'error' || status === 'missing') && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={RefreshCw}
                  onClick={() => {
                    setFailed(false)
                    file.retry()
                  }}
                >
                  {t('files.retry')}
                </Button>
              )}
            </div>
          )}
          {editable && !phone && url && (
            <>
              <span className="image-handle is-left" onPointerDown={(e) => startResize(e, -1)} aria-hidden />
              <span className="image-handle is-right" onPointerDown={(e) => startResize(e, 1)} aria-hidden />
            </>
          )}
          {drag !== null && <span className="image-size-badge">{drag}%</span>}
        </div>
        {editable && (
          <MediaToolbar
            kind="image"
            attrs={attrs}
            update={updateAttributes}
            sizes={[25, 50, 75, 100, null]}
            download={url ? { href: url, name: downloadName(src, caption) } : null}
            onCaption={() => setEditingCaption(true)}
            onClear={onClear}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        )}
      </div>
      {showCaption && (
        <MediaCaption
          value={caption}
          align={attrs.captionAlign as string}
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

function downloadName(src: string, caption: string) {
  if (!isFile(src)) return ''
  const ext = src.slice(src.lastIndexOf('.'))
  return `${(caption || 'image').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)}${ext}`
}
