import { strToU8, zipSync, type Zippable } from 'fflate'
import { openDatabase, rowDocName } from '@/core/docs/database'
import { openDoc, pageDocName, retainDoc } from '@/core/docs/registry'
import { ws } from '@/core/docs/workspace'
import { getFile } from '@/core/files/db'
import { fileRefsInDoc, fileRefsInRows, fileRefsInWorkspace } from '@/core/files/refs'
import { toCSV } from '@/core/io/csv'
import {
  asChecklist,
  asDate,
  cellOf,
  cellText,
  isoDay,
  orderedFields,
  readViewSettings,
  snapshotDatabase,
  type DatabaseSnapshot,
  type FieldMeta,
  type RowSnapshot,
} from '@/core/model/database'
import { databaseIdOf, listSpaces, listViews, type SpaceMeta, type ViewMeta } from '@/core/model/views'
import { SCHEMA_VERSION } from '@/core/schema'
import { loadDocIO } from '@/features/editor'
import { EXPORT_FORMAT, EXPORT_VERSION } from './format'
import { pageToMarkdown, type PMNode } from './toMarkdown'

export { EXPORT_FORMAT, EXPORT_VERSION }

/**
 * Export (feedback 11): a zip Notion can import ("Markdown & CSV": one `.md` per page,
 * sub-pages and attachments in a folder of the same name, a `.csv` per database) plus
 * `webnota.json`, a lossless copy of everything Markdown cannot hold — importing the zip
 * back into WebNota restores pages and databases exactly.
 */

export interface ExportedView {
  id: string
  parentId: string | null
  spaceId: string
  kind: ViewMeta['kind']
  layout: ViewMeta['layout']
  title: string
  icon: ViewMeta['icon']
  databaseId: string | null
}

export interface WebnotaExport {
  format: typeof EXPORT_FORMAT
  version: number
  schemaVersion: number
  exportedAt: number
  spaces: SpaceMeta[]
  /** Parents before children, siblings in order. */
  views: ExportedView[]
  pages: Record<string, { doc: Record<string, unknown>; page: Record<string, unknown> }>
  databases: Record<string, DatabaseSnapshot>
  /** Row page bodies (ProseMirror JSON) by database id and row id. */
  rowDocs: Record<string, Record<string, Record<string, unknown>>>
  /** File id → path of its bytes in the zip. */
  files: Record<string, string>
}

const safe = (s: string) =>
  // eslint-disable-next-line no-control-regex -- file names must not hold control characters
  (s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'Untitled').slice(0, 80).replace(/\.+$/, '')
const enc = (path: string) => path.split('/').map(encodeURIComponent).join('/')

/** Database cells the way Notion writes them in CSV. */
function csvCell(field: FieldMeta, row: RowSnapshot): string {
  const v = cellOf(field, row)
  switch (field.type) {
    case 'checkbox':
      return v === true ? 'Yes' : 'No'
    case 'date': {
      const d = asDate(v)
      if (!d) return ''
      const day = (t: number) => isoDay(t, d.includeTime).replace(/-/g, '/')
      return d.end !== undefined ? `${day(d.start)} → ${day(d.end)}` : day(d.start)
    }
    case 'checklist':
      return asChecklist(v)
        .map((i) => `${i.done ? '[x]' : '[ ]'} ${i.name}`)
        .join(', ')
    default:
      return cellText(field, v)
  }
}

/** Builds the export zip for the given views (default: every view not in the trash) and their sub-pages. */
export async function buildExport(rootIds?: string[]): Promise<{ zip: Uint8Array; pages: number; databases: number }> {
  const io = await loadDocIO()
  const all = listViews(ws())
  const alive = all.filter((v) => !v.deletedAt)
  const children = new Map<string | null, ViewMeta[]>()
  for (const v of alive) children.set(v.parentId, [...(children.get(v.parentId) ?? []), v])
  const roots = rootIds ? alive.filter((v) => rootIds.includes(v.id)) : alive.filter((v) => !v.parentId)

  // paths: "Title <id>.md" + folder "Title <id>/" for children (Notion's layout)
  const pathOf = new Map<string, { dir: string; base: string }>()
  const order: ViewMeta[] = []
  const walk = (list: ViewMeta[], dir: string) => {
    for (const v of list) {
      const base = `${safe(v.title)} ${v.id}`
      pathOf.set(v.id, { dir, base })
      order.push(v)
      walk(children.get(v.id) ?? [], dir ? `${dir}/${base}` : base)
    }
  }
  walk(roots, '')

  const files: Zippable = {}
  const data: WebnotaExport = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    spaces: listSpaces(ws()),
    views: order.map((v) => ({
      id: v.id,
      parentId: pathOf.has(v.parentId ?? '') ? v.parentId : null,
      spaceId: v.spaceId,
      kind: v.kind,
      layout: v.layout,
      title: v.title,
      icon: v.icon,
      databaseId: databaseIdOf(ws(), v.id),
    })),
    pages: {},
    databases: {},
    rowDocs: {},
    files: {},
  }

  const fileBytes = async (id: string) => (await getFile('cache', id)) ?? (await getFile('pending', id))
  const refs = fileRefsInWorkspace(ws())
  const withDoc = async <T>(name: string, f: (doc: Awaited<ReturnType<typeof openDoc>>) => T): Promise<T> => {
    const release = retainDoc(name)
    try {
      return f(await openDoc(name))
    } finally {
      release()
    }
  }
  let pages = 0
  let databases = 0
  for (const v of order) {
    const { dir, base } = pathOf.get(v.id)!
    const at = (name: string) => (dir ? `${dir}/${name}` : name)
    const link = (target: string, fromDir: string) => {
      const p = pathOf.get(target)
      if (!p) return null
      const full = p.dir ? `${p.dir}/${p.base}` : p.base
      const ext = all.find((x) => x.id === target)?.kind === 'database' ? '.csv' : '.md'
      const rel = fromDir && full.startsWith(fromDir + '/') ? full.slice(fromDir.length + 1) : full
      return enc(rel + ext)
    }
    if (v.kind === 'database') {
      const dbId = databaseIdOf(ws(), v.id)
      if (!dbId) continue
      const { docs, release } = await openDatabase(dbId)
      try {
        if (!data.databases[dbId]) {
          data.databases[dbId] = snapshotDatabase(docs)
          for (const shard of docs.shards) fileRefsInRows(shard, refs)
          const bodies: Record<string, Record<string, unknown>> = {}
          for (const r of data.databases[dbId].rows.filter((x) => x.hasDoc))
            bodies[r.id] = await withDoc(rowDocName(dbId, r.id), (d) => {
              fileRefsInDoc(d, refs)
              return io.docToJSON(d)
            })
          data.rowDocs[dbId] = bodies
        }
        const snap = data.databases[dbId]
        const view = readViewSettings(docs, v.id)
        const fields = view ? orderedFields(snap.fields, view) : snap.fields
        const rows = [fields.map((f) => f.name), ...snap.rows.map((r) => fields.map((f) => csvCell(f, r)))]
        files[at(`${base}.csv`)] = strToU8(toCSV(rows))
        databases++
      } finally {
        release()
      }
      continue
    }
    const name = pageDocName(v.id)
    const releaseDoc = retainDoc(name)
    try {
      const doc = await openDoc(name)
      const json = io.docToJSON(doc)
      fileRefsInDoc(doc, refs)
      data.pages[v.id] = { doc: json, page: doc.getMap('page').toJSON() as Record<string, unknown> }
      const folder = dir ? `${dir}/${base}` : base
      const used = new Set<string>()
      const pending: Promise<void>[] = []
      const md = pageToMarkdown(v.title || 'Untitled', json as unknown as PMNode, {
        page: (id) => {
          const href = link(id, dir)
          const t = all.find((x) => x.id === id)?.title
          return href ? { title: t || 'Untitled', href } : null
        },
        file: (id, label) => {
          const ext = id.slice(id.lastIndexOf('.'))
          let fname = safe(label.replace(/\.[a-z0-9]{1,10}$/i, '')) + ext
          for (let i = 2; used.has(fname); i++) fname = `${safe(label)} ${i}${ext}`
          used.add(fname)
          const path = `${folder}/${fname}`
          if (!data.files[id]) {
            data.files[id] = path
            pending.push(
              fileBytes(id).then((f) => {
                if (f) files[path] = f.bytes
                else delete data.files[id]
              }),
            )
          }
          return enc(`${base}/${fname}`)
        },
      })
      await Promise.all(pending)
      files[at(`${base}.md`)] = strToU8(md)
      pages++
    } finally {
      releaseDoc()
    }
  }
  // files only WebNota shows (covers, icons, media cells): kept for a lossless re-import
  for (const id of refs) {
    if (data.files[id]) continue
    const f = await fileBytes(id)
    if (!f) continue
    data.files[id] = `_files/${id}`
    files[`_files/${id}`] = f.bytes
  }
  files['webnota.json'] = strToU8(JSON.stringify(data))
  return { zip: zipSync(files, { level: 6 }), pages, databases }
}

/** Saves the export as a download. */
export async function downloadExport(rootIds?: string[]) {
  const { zip, pages, databases } = await buildExport(rootIds)
  const blob = new Blob([zip as BlobPart], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `webnota-export-${new Date().toISOString().slice(0, 10)}.zip`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return { pages, databases }
}
