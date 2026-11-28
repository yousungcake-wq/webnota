import { Download, FolderInput, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { navigate } from '@/core/store/router'
import { useCurrentSpace, useSpaces } from '@/core/store/views'
import { useLayout } from '@/platform/layout'
import { Button, Segmented, toast } from '@/ui'
import { it } from './i18n'

/** Settings → import / export (feedback 11). Loaded lazily with its dictionary. */
export function IoSection() {
  const input = useRef<HTMLInputElement>(null)
  const folder = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const phone = useLayout().layout === 'phone'
  // M8-11: into a new space (default) or the current one
  const [target, setTarget] = useState<'new' | 'current'>('new')
  const spaceId = useCurrentSpace()
  const spaceName = useSpaces().find((s) => s.id === spaceId)?.name || ''

  const track = async () => {
    const { onProgress } = await import('./progress')
    onProgress((done, total) => setProgress(total > 1 ? [done, total] : null))
    return () => {
      onProgress(null)
      setProgress(null)
    }
  }
  const onImport = async (files: File[]) => {
    setBusy(true)
    const untrack = await track()
    try {
      const { importFiles } = await import('./importer')
      const picked = await Promise.all(
        files.map(async (f) => ({
          // a folder keeps its tree: `Notes/Ideas.md`
          path: f.webkitRelativePath || f.name,
          data: new Uint8Array(await f.arrayBuffer()),
        })),
      )
      const r = await importFiles(picked, target === 'current' ? spaceId : undefined)
      toast(it('io.imported', { pages: r.pages, databases: r.databases }))
      if (r.skipped) toast(it('io.skipped', { count: r.skipped }), { tone: 'error' })
      if (r.firstViewId) navigate({ name: 'page', id: r.firstViewId })
    } catch (e) {
      if ((e as Error).message === 'cancelled') toast(it('io.cancelled'))
      else toast(it('io.failed', { error: (e as Error).message }), { tone: 'error' })
    } finally {
      untrack()
      setBusy(false)
    }
  }
  const onExport = async () => {
    setBusy(true)
    const untrack = await track()
    try {
      const { downloadExport } = await import('./exporter')
      const r = await downloadExport()
      toast(it('io.exported', { pages: r.pages, databases: r.databases }))
    } catch (e) {
      if ((e as Error).message === 'cancelled') toast(it('io.cancelled'))
      else toast(it('io.exportFailed', { error: (e as Error).message }), { tone: 'error' })
    } finally {
      untrack()
      setBusy(false)
    }
  }

  return (
    <section className="card" data-io>
      <h2>{it('io.title')}</h2>
      <p className="muted small">{it('io.desc')}</p>
      <Segmented
        label={it('io.target')}
        value={target}
        onChange={setTarget}
        options={[
          { value: 'new', label: it('io.targetNew') },
          { value: 'current', label: it('io.targetCurrent', { name: spaceName }) },
        ]}
      />
      <div className="settings-row-buttons">
        <Button icon={Upload} disabled={busy} onClick={() => input.current?.click()} data-io-import>
          {busy ? (progress ? `${it('io.working')} ${progress[0]}/${progress[1]}` : it('io.working')) : it('io.import')}
        </Button>
        {busy && (
          <Button variant="ghost" onClick={() => void import('./progress').then((m) => m.cancel())} data-io-cancel>
            {it('io.cancel')}
          </Button>
        )}
        {!phone && (
          <Button icon={FolderInput} disabled={busy} onClick={() => folder.current?.click()} data-io-folder>
            {it('io.importFolder')}
          </Button>
        )}
        <Button icon={Download} disabled={busy} onClick={() => void onExport()} data-io-export>
          {it('io.export')}
        </Button>
      </div>
      <p className="muted small">{target === 'new' ? it('io.hint') : it('io.hintCurrent')}</p>
      <input
        ref={input}
        type="file"
        multiple
        accept=".zip,application/zip,.md,.markdown,text/markdown,.txt,text/plain,.html,.htm,text/html,image/*"
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) void onImport(files)
        }}
      />
      <input
        ref={folder}
        type="file"
        hidden
        {...{ webkitdirectory: '' }}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) void onImport(files)
        }}
      />
    </section>
  )
}
