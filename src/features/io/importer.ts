import { strFromU8, unzipSync } from 'fflate'
import { openDatabase, rowDocName } from '@/core/docs/database'
import { openDoc, pageDocName, retainDoc } from '@/core/docs/registry'
import { ws } from '@/core/docs/workspace'
import { addFile, ingestFile } from '@/core/files/ingest'
import { parseCSV } from '@/core/io/csv'
import { addField, createDatabase, importCsvRows, restoreDatabase, type InferredColumn } from '@/core/model/database'
import { createSpace, createView, newId } from '@/core/model/views'
import { loadDocIO, loadMarkdown } from '@/features/editor'
import type { WebnotaExport } from './exporter'
import { EXPORT_FORMAT } from './format'
import { it } from './i18n'
import { attachmentsOf, planNotionImport, rewriteNotionMarkdown } from './notion'

/**
 * Import (feedback 11): a WebNota export zip (its `webnota.json` restores everything
 * exactly) or a Notion "Markdown & CSV" export (pages, sub-pages, databases from CSV,
 * attachments). Always adds a new space, so nothing existing is touched.
 */

export interface ImportResult {
  spaceId: string
  /** First imported page, to open. */
  firstViewId: string | null
  pages: number
  databases: number
  /** Attachments that could not be stored (too large, unreadable). */
  skipped: number
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  txt: 'text/plain',
}
const mimeOf = (name: string) => MIME[name.slice(name.lastIndexOf('.') + 1).toLowerCase()] ?? ''
const nameOf = (p: string) => p.slice(p.lastIndexOf('/') + 1)
const dirOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')

/** Every file of the zip, with zips inside it (Notion splits large exports) unpacked in place. */
export function readZip(bytes: Uint8Array, prefix = '', out = new Map<string, Uint8Array>()) {
  const entries = unzipSync(bytes)
  for (const [path, data] of Object.entries(entries)) {
    if (path.endsWith('/') || path.startsWith('__MACOSX/') || nameOf(path) === '.DS_Store') continue
    if (/\.zip$/i.test(path)) readZip(data, prefix, out)
    else out.set(prefix + path, data)
  }
  return out
}

async function withDoc<T>(name: string, f: (doc: Awaited<ReturnType<typeof openDoc>>) => T): Promise<T> {
  const release = retainDoc(name)
  try {
    return f(await openDoc(name))
  } finally {
    release()
  }
}

export async function importZip(bytes: Uint8Array): Promise<ImportResult> {
  const files = readZip(bytes)
  const manifest = [...files.keys()].find((p) => nameOf(p) === 'webnota.json')
  if (manifest) {
    const data = JSON.parse(strFromU8(files.get(manifest)!)) as WebnotaExport
    if (data.format === EXPORT_FORMAT) return importWebnota(data, files, dirOf(manifest))
  }
  return importNotion(files)
}

// ---------- WebNota (lossless) ----------

async function importWebnota(data: WebnotaExport, zip: Map<string, Uint8Array>, root: string): Promise<ImportResult> {
  const io = await loadDocIO()
  const at = (p: string) => (root ? `${root}/${p}` : p)
  // files first: ids are content hashes, so the same bytes get the same id back
  const ids = new Map<string, string>()
  let skipped = 0
  for (const [id, path] of Object.entries(data.files)) {
    const b = zip.get(at(path))
    if (!b) continue
    try {
      const ref = await addFile(new Blob([b as BlobPart], { type: mimeOf(id) }), id)
      if (ref.id !== id) ids.set(id, ref.id)
    } catch {
      skipped++
    }
  }
  for (const v of data.views) ids.set(v.id, newId())
  const dbIds = new Map(Object.keys(data.databases).map((id) => [id, newId()]))
  const remap = <T>(value: T): T => {
    let s = JSON.stringify(value)
    for (const [from, to] of ids) s = s.split(from).join(to)
    return JSON.parse(s) as T
  }

  // one new space per exported space that has views
  const spaces = new Map<string, string>()
  const firstSpace = () => spaces.values().next().value as string
  for (const s of data.spaces)
    if (data.views.some((v) => v.spaceId === s.id && !v.parentId))
      spaces.set(s.id, createSpace(ws(), { name: s.name, icon: s.icon, color: s.color, visibility: s.visibility }))
  if (!spaces.size) spaces.set('', createSpace(ws(), { name: it('io.importedSpace') }))

  for (const v of data.views)
    createView(ws(), {
      id: ids.get(v.id),
      parentId: v.parentId ? ids.get(v.parentId) : null,
      spaceId: spaces.get(v.spaceId) ?? firstSpace(),
      title: v.title,
      icon: remap(v.icon),
      kind: v.kind,
      layout: v.layout,
      databaseId: v.databaseId ? (dbIds.get(v.databaseId) ?? null) : null,
    })

  for (const [viewId, page] of Object.entries(data.pages)) {
    const id = ids.get(viewId)
    if (!id) continue
    await withDoc(pageDocName(id), (doc) => {
      io.jsonIntoDoc(doc, remap(page.doc))
      const m = doc.getMap<unknown>('page')
      doc.transact(() => {
        for (const [k, val] of Object.entries(remap(page.page))) m.set(k, val)
      })
    })
  }
  for (const [oldDb, snap] of Object.entries(data.databases)) {
    const dbId = dbIds.get(oldDb)!
    const { docs, release } = await openDatabase(dbId)
    try {
      // view ids inside the snapshot are already the new ones
      restoreDatabase(docs, remap(snap), new Map([...ids.values()].map((x) => [x, x])))
    } finally {
      release()
    }
    for (const [rowId, body] of Object.entries(data.rowDocs?.[oldDb] ?? {}))
      await withDoc(rowDocName(dbId, rowId), (doc) => io.jsonIntoDoc(doc, remap(body)))
  }
  const top = data.views.find((v) => !v.parentId)
  return {
    spaceId: firstSpace(),
    firstViewId: top ? ids.get(top.id)! : null,
    pages: Object.keys(data.pages).length,
    databases: Object.keys(data.databases).length,
    skipped,
  }
}

// ---------- Notion (Markdown & CSV) ----------

/** Notion row pages repeat the row's properties under the title ("Status: Done"): dropped, the CSV has them. */
export function stripNotionProperties(md: string): string {
  const lines = md.split('\n')
  let i = 0
  while (i < lines.length && !lines[i]!.trim()) i++
  let j = i
  while (j < lines.length && /^[^:\n#>*\-|`]{1,60}: /.test(lines[j]!)) j++
  return j > i ? lines.slice(j).join('\n') : md
}

async function importNotion(zip: Map<string, Uint8Array>): Promise<ImportResult> {
  const plan = planNotionImport([...zip.keys()])
  if (!plan.length) throw new Error(it('io.nothing'))
  const [io, { markdownToHtml }] = await Promise.all([loadDocIO(), loadMarkdown()])
  const day = new Date().toISOString().slice(0, 10)
  const spaceId = createSpace(ws(), { name: `${it('io.notionSpace')} ${day}` })
  const viewOf = new Map<string, string>()
  const csvRows = new Map<string, string[][]>()
  const dbOf = (path: string) => plan.find((p) => p.path === path && p.kind === 'database')
  let skipped = 0
  let pages = 0
  let databases = 0

  // views (parents come first in the plan)
  for (const item of plan) {
    const parentId = item.parent ? (viewOf.get(item.parent) ?? null) : null
    if (item.kind === 'database') {
      const rows = parseCSV(strFromU8(zip.get(item.path)!))
      const header = rows[0] ?? ['Name']
      const records = rows.slice(1).filter((r) => r.some((c) => c.trim()))
      csvRows.set(item.path, rows)
      const dbId = newId()
      const { docs, release } = await openDatabase(dbId)
      try {
        const { viewId } = createDatabase(ws(), docs, {
          dbId,
          parentId,
          spaceId,
          title: item.title,
          primaryName: header[0] || 'Name',
        })
        importCsvRows(docs, header, records, (name: string, col: InferredColumn) =>
          addField(docs, { name, type: col.type, options: col.options }),
        )
        viewOf.set(item.path, viewId)
        databases++
      } finally {
        release()
      }
      continue
    }
    // a database row: a child page only when it has a body beyond its properties
    if (item.parent && dbOf(item.parent)) {
      const md = strFromU8(zip.get(item.path)!).replace(/^#\s+.*\n?/, '')
      if (!stripNotionProperties(md).trim()) continue
    }
    viewOf.set(item.path, createView(ws(), { parentId, spaceId, title: item.title }))
  }
  // links may point at either `X.csv` or `X_all.csv`
  for (const item of plan)
    if (item.kind === 'database') {
      const v = viewOf.get(item.path)!
      viewOf.set(item.path.replace(/_all\.csv$/i, '.csv'), v)
      viewOf.set(item.path.replace(/(?<!_all)\.csv$/i, '_all.csv'), v)
    }

  // page bodies
  const fileIds = new Map<string, string | null>()
  for (const item of plan) {
    if (item.kind !== 'page') continue
    const viewId = viewOf.get(item.path)
    if (!viewId) continue
    const dir = dirOf(item.path)
    let md = strFromU8(zip.get(item.path)!)
    if (item.parent && dbOf(item.parent)) {
      const m = md.match(/^#\s+.*\n?/)
      md = (m ? m[0] : '') + stripNotionProperties(md.slice(m ? m[0].length : 0))
    }
    for (const path of attachmentsOf(md, dir)) {
      if (fileIds.has(path)) continue
      const b = zip.get(path)
      if (!b) {
        fileIds.set(path, null)
        continue
      }
      try {
        const ref = await ingestFile(new Blob([b as BlobPart], { type: mimeOf(path) }), nameOf(path))
        fileIds.set(path, ref.id)
      } catch {
        fileIds.set(path, null)
        skipped++
      }
    }
    const html = markdownToHtml(
      rewriteNotionMarkdown(md, item.title, {
        dir,
        page: (p) => viewOf.get(p) ?? null,
        file: (p) => fileIds.get(p) ?? null,
      }),
    )
    await withDoc(pageDocName(viewId), (doc) => io.htmlIntoDoc(doc, html))
    pages++
  }
  const first = plan.find((i) => !i.parent)
  return { spaceId, firstViewId: first ? (viewOf.get(first.path) ?? null) : null, pages, databases, skipped }
}
