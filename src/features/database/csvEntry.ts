import { openDatabase } from '@/core/docs/database'
import { ws } from '@/core/docs/workspace'
import { createDatabase } from '@/core/model/database'
import { newId } from '@/core/model/views'
import { toggleExpanded } from '@/core/store/prefs'
import { navigate } from '@/core/store/router'
import { setPendingCsv } from './csvPending'
import { dt, loadDbMessages } from './i18n'

/** "Import CSV" from the new view menu (M6-06): an empty database named after the file, then its preview. */
export async function importCsvAsDatabase(opts: { file: File; parentId: string | null; spaceId?: string }) {
  await loadDbMessages()
  const dbId = newId()
  const { docs, release } = await openDatabase(dbId)
  try {
    const { viewId } = createDatabase(ws(), docs, {
      dbId,
      parentId: opts.parentId,
      spaceId: opts.spaceId,
      title: opts.file.name.replace(/\.(csv|tsv|txt)$/i, ''),
      primaryName: dt('db.field.name'),
      rows: 0,
    })
    setPendingCsv(viewId, opts.file)
    if (opts.parentId) toggleExpanded(opts.parentId, true)
    navigate({ name: 'page', id: viewId })
  } finally {
    release()
  }
}

/** Reads and parses a CSV file in a worker. */
export async function readCsv(file: File): Promise<string[][]> {
  const text = await file.text()
  const worker = new Worker(new URL('./csv.worker.ts', import.meta.url), { type: 'module' })
  try {
    return await new Promise<string[][]>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<{ rows?: string[][]; error?: string }>) =>
        e.data.rows ? resolve(e.data.rows) : reject(new Error(e.data.error ?? 'csv'))
      worker.onerror = () => reject(new Error('csv worker'))
      worker.postMessage({ text })
    })
  } finally {
    worker.terminate()
  }
}
