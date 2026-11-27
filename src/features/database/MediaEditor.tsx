import { File as FileIcon, GripVertical, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import {
  asMedia,
  getRow,
  setCell,
  setFieldOptions,
  type DbDocs,
  type FieldMeta,
  type MediaItem,
} from '@/core/model/database'
import { downloadFile, useImageSrc } from '@/features/files'
import { Switch, toast } from '@/ui'
import { dt } from './i18n'
import { useReorder } from './useReorder'

/** A small preview: the image itself, or a file icon. */
export function MediaThumb({ item, size = 24 }: { item: MediaItem; size?: number }) {
  const image = item.mime.startsWith('image/')
  const src = useImageSrc(image ? item.fileId : null)
  return image && src ? (
    <img className="db-thumb" src={src} alt="" width={size} height={size} />
  ) : (
    <span className="db-thumb is-file" style={{ width: size, height: size }} aria-hidden>
      <FileIcon size={Math.round(size * 0.6)} />
    </span>
  )
}

/** Files & media cell editor (spec/05 §3.2): upload, preview, open, delete, reorder. */
export function MediaEditor({
  docs,
  field,
  rowId,
  value,
  readOnly,
}: {
  docs: DbDocs
  field: FieldMeta
  rowId: string
  value: unknown
  readOnly: boolean
}) {
  const items = asMedia(value)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const write = (next: MediaItem[]) => setCell(docs, rowId, field.id, next.length ? next : null)
  const reorder = useReorder((from, to) => {
    const next = [...items]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it!)
    write(next)
  })

  const upload = async (files: File[]) => {
    const { ingestFile, MAX_FILE_BYTES, MAX_FILE_MB } = await import('@/core/files/ingest')
    setBusy((n) => n + files.length)
    const added: MediaItem[] = []
    for (const f of files) {
      try {
        if (f.size > MAX_FILE_BYTES) {
          toast(dt('db.media.tooLarge', { name: f.name, max: MAX_FILE_MB }), { tone: 'error' })
          continue
        }
        const ref = await ingestFile(f, f.name)
        added.push({ fileId: ref.id, name: ref.name, mime: ref.mime, size: ref.size })
      } finally {
        setBusy((n) => n - 1)
      }
    }
    // re-read: the cell may have changed while uploading
    if (added.length) write([...asMedia(getRow(docs, rowId)?.cells[field.id]), ...added])
  }

  return (
    <div className="db-media">
      <div className="db-list">
        {items.map((it, i) => (
          <div key={`${it.fileId}-${i}`} className="db-option" data-reorder-item style={reorder.style(i)}>
            {!readOnly && (
              <span className="db-grip" {...reorder.handle(i)}>
                <GripVertical size={14} aria-hidden />
              </span>
            )}
            <button
              type="button"
              className="db-option-main"
              aria-label={dt('db.media.open', { name: it.name })}
              onClick={() => void downloadFile(it.fileId, it.name)}
            >
              <MediaThumb item={it} size={32} />
              <span className="db-media-name">{it.name}</span>
            </button>
            {!readOnly && (
              <button
                type="button"
                className="db-icon-btn"
                aria-label={dt('db.media.delete', { name: it.name })}
                onClick={() => write(items.filter((_, k) => k !== i))}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            )}
          </div>
        ))}
        {!items.length && !busy && <div className="db-empty">{dt('db.media.empty')}</div>}
        {busy > 0 && (
          <div className="db-empty" role="status">
            …
          </div>
        )}
      </div>
      {!readOnly && (
        <>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            aria-label={dt('db.media.add')}
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              if (files.length) void upload(files)
            }}
          />
          <button type="button" className="db-option-create" onClick={() => input.current?.click()}>
            <Plus size={14} aria-hidden /> {dt('db.media.add')}
          </button>
          <Switch
            checked={field.options.hideFileNames === true}
            label={dt('db.media.hideNames')}
            onChange={(on) => setFieldOptions(docs, field.id, { hideFileNames: on })}
          />
        </>
      )}
    </div>
  )
}
