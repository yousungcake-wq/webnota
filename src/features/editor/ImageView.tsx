import type { ReactNodeViewProps } from '@tiptap/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Captions,
  Download,
  ExternalLink,
  ImagePlus,
  Link2,
  Maximize2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { t } from '@/core/i18n'
import { fileStatusKey, useFile } from '@/features/files'
import { useLayout } from '@/platform/layout'
import { Button, IconButton, Menu, promptDialog, toast } from '@/ui'
import { imageBoxStyle } from './ImageBlock'
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

export default function ImageView({ node, updateAttributes, deleteNode, editor, selected }: ReactNodeViewProps) {
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
        selected={selected}
        updateAttributes={updateAttributes}
        onReplace={() => pickImage(input.current)}
        onDelete={deleteNode}
      />
    </>
  )
}

function Figure({
  src,
  attrs,
  editable,
  selected,
  updateAttributes,
  onReplace,
  onDelete,
}: {
  src: string
  attrs: Record<string, unknown>
  editable: boolean
  selected: boolean
  updateAttributes: (a: Record<string, unknown>) => void
  onReplace: () => void
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
  const [sizeMenu, setSizeMenu] = useState<HTMLElement | null>(null)
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
      <div ref={frame} className={`image-frame${url && !failed ? '' : ' is-placeholder'}`} style={style}>
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
      {selected && editable && (
        <div className="image-toolbar" role="toolbar" aria-label={t('image.toolbar')}>
          {(['left', 'center', 'right'] as const).map((a) => (
            <IconButton
              key={a}
              size="sm"
              icon={a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight}
              label={t(`image.align.${a}`)}
              active={(attrs.align as string) === a}
              onClick={() => updateAttributes({ align: a })}
            />
          ))}
          <IconButton
            size="sm"
            icon={Maximize2}
            label={t('image.size')}
            onClick={(e) => setSizeMenu(e.currentTarget)}
          />
          <IconButton
            size="sm"
            icon={Captions}
            label={t('image.caption')}
            active={showCaption}
            onClick={() => setEditingCaption(true)}
          />
          <IconButton size="sm" icon={RefreshCw} label={t('image.replace')} onClick={onReplace} />
          {url && (
            <a
              className="icon-btn sm"
              href={url}
              download={downloadName(src, caption)}
              aria-label={t('image.download')}
              data-tooltip={t('image.download')}
            >
              <Download size={16} />
            </a>
          )}
          {url && !phone && (
            <a
              className="icon-btn sm"
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={t('image.open')}
              data-tooltip={t('image.open')}
            >
              <ExternalLink size={16} />
            </a>
          )}
          <IconButton size="sm" icon={Trash2} tone="danger" label={t('image.delete')} onClick={onDelete} />
          {sizeMenu && (
            <Menu
              anchor={sizeMenu}
              title={t('image.size')}
              onClose={() => setSizeMenu(null)}
              items={[
                ...[25, 50, 75, 100].map((w) => ({
                  label: `${w}%`,
                  checked: attrs.width === w,
                  onSelect: () => updateAttributes({ width: w }),
                })),
                {
                  label: t('image.sizeOriginal'),
                  checked: !attrs.width,
                  onSelect: () => updateAttributes({ width: null }),
                },
              ]}
            />
          )}
        </div>
      )}
      {showCaption && (
        <Caption
          value={caption}
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

function Caption({
  value,
  editable,
  autoFocus,
  onCommit,
}: {
  value: string
  editable: boolean
  autoFocus: boolean
  onCommit: (v: string) => void
}) {
  const [text, setText] = useState(value)
  if (!editable) return <figcaption className="image-caption">{value}</figcaption>
  return (
    <figcaption className="image-caption">
      <input
        value={text}
        placeholder={t('image.captionPlaceholder')}
        aria-label={t('image.caption')}
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

function downloadName(src: string, caption: string) {
  if (!isFile(src)) return ''
  const ext = src.slice(src.lastIndexOf('.'))
  return `${(caption || 'image').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)}${ext}`
}
