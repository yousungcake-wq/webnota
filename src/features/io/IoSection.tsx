import { Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { navigate } from '@/core/store/router'
import { Button, toast } from '@/ui'
import { it } from './i18n'

/** Settings → import / export (feedback 11). Loaded lazily with its dictionary. */
export function IoSection() {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const onImport = async (file: File) => {
    setBusy(true)
    try {
      const { importZip } = await import('./importer')
      const r = await importZip(new Uint8Array(await file.arrayBuffer()))
      toast(it('io.imported', { pages: r.pages, databases: r.databases }))
      if (r.skipped) toast(it('io.skipped', { count: r.skipped }), { tone: 'error' })
      if (r.firstViewId) navigate({ name: 'page', id: r.firstViewId })
    } catch (e) {
      toast(it('io.failed', { error: (e as Error).message }), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  const onExport = async () => {
    setBusy(true)
    try {
      const { downloadExport } = await import('./exporter')
      const r = await downloadExport()
      toast(it('io.exported', { pages: r.pages, databases: r.databases }))
    } catch (e) {
      toast(it('io.exportFailed', { error: (e as Error).message }), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" data-io>
      <h2>{it('io.title')}</h2>
      <p className="muted small">{it('io.desc')}</p>
      <div className="settings-row-buttons">
        <Button icon={Upload} disabled={busy} onClick={() => input.current?.click()} data-io-import>
          {busy ? it('io.working') : it('io.import')}
        </Button>
        <Button icon={Download} disabled={busy} onClick={() => void onExport()} data-io-export>
          {it('io.export')}
        </Button>
      </div>
      <p className="muted small">{it('io.hint')}</p>
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void onImport(f)
        }}
      />
    </section>
  )
}
