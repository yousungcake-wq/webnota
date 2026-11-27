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
import { use, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { downloadFile } from '@/features/files'
import { IconButton, Menu, type MenuEntry } from '@/ui'
import { loadMediaMessages, mt } from './mediaI18n'
import type { MediaKey } from './mediaI18n/ko'
import './media.css'

const messages = loadMediaMessages()
type Align = 'left' | 'center' | 'right'
const ALIGN_ICON = { left: AlignLeft, center: AlignCenter, right: AlignRight }

/** What the download button saves: a workspace file (through the file cache) or a web address. */
export type MediaDownload = { fileId: string; name: string } | { url: string; name: string }

/** Saves a web image / video as a file; when the site does not allow it, opens it in a new tab. */
async function saveUrl(url: string, name: string) {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(String(res.status))
    const href = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = href
    a.download = name || url.split('/').pop()?.split('?')[0] || 'download'
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 10_000)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/**
 * The toolbar of image and video blocks (feedback 4–5, 2-4/2-5), floating at the media's
 * top-right corner: align, caption (becomes "caption alignment" once there is a caption),
 * download, clear (keep the block, empty), duplicate, delete.
 */
export function MediaToolbar({
  kind,
  attrs,
  update,
  captionShown,
  download,
  onCaption,
  onClear,
  onDuplicate,
  onDelete,
}: {
  kind: 'image' | 'video'
  attrs: Record<string, unknown>
  update: (a: Record<string, unknown>) => void
  /** A caption is shown (or being written): the caption button turns into caption alignment. */
  captionShown: boolean
  download: MediaDownload | null
  onCaption: () => void
  onClear: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  use(messages)
  const [menu, setMenu] = useState<{ which: 'align' | 'caption'; anchor: HTMLElement } | null>(null)
  // a media box narrower than the toolbar: it is placed by the media's alignment so it stays on screen
  const bar = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const el = bar.current
    const box = el?.parentElement
    if (!el || !box) return
    const check = () => setNarrow(box.clientWidth < el.offsetWidth + 16)
    const ro = new ResizeObserver(check)
    ro.observe(box)
    check()
    return () => ro.disconnect()
  }, [])
  const align = ((attrs.align as Align) || 'center') as Align
  const captionAlign = ((attrs.captionAlign as Align) || 'left') as Align
  const alignItems = (key: 'align' | 'captionAlign', current: Align): MenuEntry[] =>
    (['left', 'center', 'right'] as const).map((a) => ({
      label: mt(`mt.${a}` as MediaKey),
      icon: ALIGN_ICON[a],
      checked: current === a,
      onSelect: () => update({ [key]: a }),
    }))
  const btn = (icon: typeof Copy, label: MediaKey, onClick: (e: React.MouseEvent<HTMLButtonElement>) => void) => (
    <IconButton
      size="sm"
      icon={icon}
      label={mt(label)}
      // keep the editor from taking the focus (and the caret from the caption) on press
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    />
  )
  return (
    <div
      ref={bar}
      className={`media-tools${narrow ? ' is-narrow' : ''}`}
      role="toolbar"
      aria-label={mt('mt.toolbar')}
      contentEditable={false}
    >
      {btn(
        kind === 'image' ? ImageIcon : ALIGN_ICON[align],
        kind === 'image' ? 'mt.alignImage' : 'mt.alignVideo',
        (e) => setMenu({ which: 'align', anchor: e.currentTarget }),
      )}
      {captionShown
        ? btn(ALIGN_ICON[captionAlign], 'mt.captionAlign', (e) =>
            setMenu({ which: 'caption', anchor: e.currentTarget }),
          )
        : btn(Captions, 'mt.caption', onCaption)}
      {download &&
        btn(Download, 'mt.download', () =>
          'fileId' in download
            ? void downloadFile(download.fileId, download.name)
            : void saveUrl(download.url, download.name),
        )}
      {btn(Eraser, 'mt.clear', onClear)}
      {btn(Copy, 'mt.duplicate', onDuplicate)}
      <IconButton
        size="sm"
        icon={Trash2}
        tone="danger"
        label={mt('mt.delete')}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onDelete}
      />
      {menu && (
        <Menu
          anchor={menu.anchor}
          title={
            menu.which === 'align' ? mt(kind === 'image' ? 'mt.alignImage' : 'mt.alignVideo') : mt('mt.captionAlign')
          }
          onClose={() => setMenu(null)}
          items={menu.which === 'align' ? alignItems('align', align) : alignItems('captionAlign', captionAlign)}
        />
      )}
    </div>
  )
}

/**
 * Side handles that resize a media box by dragging (width in % of the text column, 10–100),
 * with mouse or finger (feedback 2-4/2-5). Returns the live width while dragging.
 */
export function useMediaResize(
  box: RefObject<HTMLElement | null>,
  align: string | undefined,
  commit: (width: number | null) => void,
) {
  const [drag, setDrag] = useState<number | null>(null)
  const start = (e: ReactPointerEvent, side: 1 | -1) => {
    const el = box.current
    // the figure spans the text column; widths are a share of it
    const column = el?.closest('figure') ?? el?.parentElement
    if (!el || !column) return
    e.preventDefault()
    e.stopPropagation()
    // the moves keep coming to the handle even over a video's iframe
    try {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    } catch {
      // synthetic events have no active pointer
    }
    const startX = e.clientX
    const startW = el.getBoundingClientRect().width
    const full = column.getBoundingClientRect().width
    // a centred box grows on both sides
    const k = (align || 'center') === 'center' ? 2 : 1
    let pct = Math.round((startW / full) * 100)
    const move = (ev: PointerEvent) => {
      const w = startW + (ev.clientX - startX) * side * k
      pct = Math.round(Math.min(100, Math.max(10, (w / full) * 100)))
      setDrag(pct)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setDrag(null)
      commit(pct >= 100 ? null : pct)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  const handles = (
    <>
      <span className="media-handle is-left" onPointerDown={(e) => start(e, -1)} aria-hidden />
      <span className="media-handle is-right" onPointerDown={(e) => start(e, 1)} aria-hidden />
      {drag !== null && <span className="media-size-badge">{drag}%</span>}
    </>
  )
  return { drag, handles }
}

/**
 * Caption under an image or video; its alignment is the block's `captionAlign`. A new
 * caption takes the caret at once; Backspace in an empty caption removes it (feedback 2-4).
 */
export function MediaCaption({
  value,
  align,
  editable,
  autoFocus,
  onCommit,
  onRemove,
}: {
  value: string
  align: string
  editable: boolean
  autoFocus: boolean
  onCommit: (v: string) => void
  onRemove: () => void
}) {
  use(messages)
  const [text, setText] = useState(value)
  const input = useRef<HTMLInputElement>(null)
  const removed = useRef(false)
  useEffect(() => {
    if (!autoFocus) return
    // after the click that asked for it, so the editor does not take the focus back
    const id = setTimeout(() => input.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [autoFocus])
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
        ref={input}
        value={text}
        placeholder={mt('mt.captionPlaceholder')}
        aria-label={mt('mt.caption')}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (!removed.current) onCommit(text.trim())
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            e.currentTarget.blur()
          }
          if (e.key === 'Escape') {
            setText(value)
            e.currentTarget.blur()
          }
          if (e.key === 'Backspace' && text === '' && !e.nativeEvent.isComposing) {
            e.preventDefault()
            removed.current = true
            onRemove()
          }
        }}
      />
    </figcaption>
  )
}
