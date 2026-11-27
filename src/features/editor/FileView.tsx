import type { ReactNodeViewProps } from '@tiptap/react'
import {
  CloudUpload,
  Download,
  File,
  FileArchive,
  FileAudio,
  FileText,
  FileVideo,
  Paperclip,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { t } from '@/core/i18n'
import { syncStore } from '@/core/sync/controller'
import { useStore } from '@/core/store/useStore'
import { downloadFile, isFilePending } from '@/features/files'
import { Button, IconButton, toast } from '@/ui'
import { formatSize } from './nodes/file'
import './file.css'

function FileIcon({ mime, name }: { mime: string; name: string }) {
  const props = { size: 20, className: 'file-icon', 'aria-hidden': true } as const
  if (mime.startsWith('video/')) return <FileVideo {...props} />
  if (mime.startsWith('audio/')) return <FileAudio {...props} />
  if (mime === 'application/pdf' || mime.startsWith('text/')) return <FileText {...props} />
  if (/\.(zip|7z|rar|gz|tar)$/i.test(name)) return <FileArchive {...props} />
  return <File {...props} />
}

async function store(file: globalThis.File) {
  const m = await import('@/core/files/ingest')
  try {
    // attachments are stored as they are (no image preprocessing)
    const ref = await m.addFile(file, file.name)
    return { fileId: ref.id, name: ref.name, size: ref.size, mime: ref.mime }
  } catch (e) {
    toast(e instanceof m.FileTooLargeError ? t('files.tooLarge', { max: m.MAX_FILE_MB }) : t('files.error'), {
      tone: 'error',
    })
    return null
  }
}

/** Re-checked after each sync: "waiting for upload" until the file is in the repository. */
function usePending(id: string | null) {
  const synced = useStore(syncStore, (s) => s.lastSyncedAt)
  const [pending, setPending] = useState<{ id: string; v: boolean } | null>(null)
  useEffect(() => {
    if (!id) return
    let alive = true
    void isFilePending(id).then((v) => alive && setPending({ id, v }))
    return () => {
      alive = false
    }
  }, [id, synced])
  return pending?.id === id && pending.v
}

export default function FileView({ node, updateAttributes, deleteNode, editor, selected }: ReactNodeViewProps) {
  const id = node.attrs.fileId as string | null
  const name = (node.attrs.name as string) || id || ''
  const editable = editor.isEditable
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pending = usePending(id)

  const fileInput = (
    <input
      ref={input}
      type="file"
      hidden
      onChange={(e) => {
        const f = e.currentTarget.files?.[0]
        e.currentTarget.value = ''
        if (!f) return
        setBusy(true)
        void store(f).then((attrs) => {
          setBusy(false)
          if (attrs) updateAttributes(attrs)
        })
      }}
    />
  )

  if (!id) {
    return (
      <div className="file-row is-empty" contentEditable={false}>
        {fileInput}
        <Paperclip size={18} aria-hidden />
        {busy ? (
          <span role="status">{t('upload.processing', { name: '' })}</span>
        ) : editable ? (
          <Button size="sm" icon={Upload} onClick={() => input.current?.click()}>
            {t('file.upload')}
          </Button>
        ) : (
          <span>{t('file.empty')}</span>
        )}
      </div>
    )
  }

  return (
    <div className="file-row" contentEditable={false}>
      <FileIcon mime={node.attrs.mime as string} name={name} />
      <button
        type="button"
        className="file-name"
        onClick={() => void downloadFile(id, name)}
        title={t('file.download')}
      >
        {name}
      </button>
      <span className="file-meta">
        {formatSize(node.attrs.size as number)}
        {pending && (
          <span className="file-pending" title={t('file.pendingHint')}>
            <CloudUpload size={14} aria-hidden /> {t('file.pending')}
          </span>
        )}
      </span>
      <IconButton size="sm" icon={Download} label={t('file.download')} onClick={() => void downloadFile(id, name)} />
      {selected && editable && (
        <IconButton size="sm" icon={Trash2} tone="danger" label={t('file.delete')} onClick={deleteNode} />
      )}
    </div>
  )
}
