import { strFromU8, unzipSync } from 'fflate'
import { openDatabase, rowDocName } from '@/core/docs/database'
import { openDoc, pageDocName, retainDoc } from '@/core/docs/registry'
import { ws } from '@/core/docs/workspace'
import { addFile, ingestFile } from '@/core/files/ingest'
import { parseCSV } from '@/core/io/csv'
import {
  addField,
  addRelationField,
  createDatabase,
  deleteField,
  importCsvRows,
  listFields,
  listRows,
  readDbMeta,
  restoreDatabase,
  setRelation,
  updateRow,
  type InferredColumn,
} from '@/core/model/database'
import { createSpace, createView, newId } from '@/core/model/views'
import { loadDocIO, loadMarkdown } from '@/features/editor'
import type { WebnotaExport } from './exporter'
import { EXPORT_FORMAT } from './format'
import { it } from './i18n'
import {
  attachmentsOf,
  FILE_PAGES,
  linkParents,
  NOTION_PAGES,
  parseRelationCell,
  planNotionImport,
  relationTarget,
  resolveRelative,
  rewriteNotionMarkdown,
} from './notion'

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
  return importTree(files, { pages: NOTION_PAGES, spaceName: it('io.notionSpace') })
}

/**
 * Picked files (M8-01~03): Markdown, text and HTML pages — a folder keeps its tree (paths
 * like `Notes/Ideas.md`, a folder `Notes/` beside `Notes.md` holds its sub-pages), with
 * the images and files they link to; a single zip is a Notion or WebNota export.
 */
export async function importFiles(picked: { path: string; data: Uint8Array }[]): Promise<ImportResult> {
  const zips = picked.filter((f) => /\.zip$/i.test(f.path))
  if (zips.length === 1 && picked.length === 1) return importZip(zips[0]!.data)
  const files = new Map<string, Uint8Array>()
  for (const f of picked) {
    if (/\.zip$/i.test(f.path)) readZip(f.data, dirOf(f.path) ? `${dirOf(f.path)}/` : '', files)
    else files.set(f.path, f.data)
  }
  const { root, files: tree } = folderPages(files)
  return importTree(tree, { pages: FILE_PAGES, spaceName: root ?? it('io.filesSpace'), dated: !root })
}

/**
 * A picked folder (M8-01): its name names the space, and every sub-folder with pages but
 * no page of its own (`Projects/` without `Projects.md`) gets an empty page, so the tree
 * keeps its shape.
 */
export function folderPages(files: Map<string, Uint8Array>): { root: string | null; files: Map<string, Uint8Array> } {
  const pages = [...files.keys()].filter((p) => FILE_PAGES.test(p))
  const firsts = new Set(pages.map((p) => (p.includes('/') ? p.split('/')[0] : '')))
  const root = firsts.size === 1 && !firsts.has('') ? [...firsts][0]! : null
  const out = new Map<string, Uint8Array>()
  for (const [p, b] of files) out.set(root ? p.slice(root.length + 1) : p, b)
  const has = (dir: string) => [...out.keys()].some((p) => FILE_PAGES.test(p) && p.replace(/\.[^./]+$/, '') === dir)
  for (const p of [...out.keys()].filter((x) => FILE_PAGES.test(x)))
    for (let d = dirOf(p); d; d = dirOf(d)) if (!has(d)) out.set(`${d}.md`, new Uint8Array())
  return { root, files: out }
}

/** Text in UTF-8, or else the Korean legacy encoding (EUC-KR / CP949) of older files. */
export function decodeText(b: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b).replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('euc-kr').decode(b)
  }
}

/** YAML front matter: removed from the body; its `title:` names the page. */
export function frontMatter(md: string): { title: string | null; body: string } {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(md)
  if (!m) return { title: null, body: md }
  const t = /^title:\s*(.+)$/m
    .exec(m[1]!)?.[1]
    ?.trim()
    .replace(/^(['"])(.*)\1$/, '$2')
  return { title: t || null, body: md.slice(m[0].length) }
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Plain text → paragraphs, one per line (empty lines dropped). */
export function textToHtml(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
    .map((l) => `<p>${escHtml(l)}</p>`)
    .join('')
}

/**
 * An HTML file → the markup the editor reads: its body without scripts, styles and
 * frames; images with a relative `src` point at the stored file. The editor's schema then
 * keeps only what it knows (headings, lists, tables, links…) — no attribute survives
 * that the schema does not define, so nothing active gets in.
 */
export function htmlFileToHtml(html: string, dir: string, file: (path: string) => string | null): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc
    .querySelectorAll('script, style, iframe, object, embed, noscript, template, link, meta')
    .forEach((n) => n.remove())
  doc.querySelectorAll<HTMLImageElement>('img[src]').forEach((img) => {
    const src = img.getAttribute('src')!
    const id = /^(https?:|data:)/i.test(src) ? null : file(resolveRelative(dir, src) ?? '')
    if (!id) return
    const stored = doc.createElement('img')
    stored.alt = img.alt
    stored.setAttribute('data-file', id)
    img.replaceWith(stored)
  })
  return doc.body.innerHTML
}

/** Relative image paths an HTML file uses. */
function htmlAttachments(html: string, dir: string): string[] {
  const out = new Set<string>()
  for (const m of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    const p = /^(https?:|data:)/i.test(m[1]!) ? null : resolveRelative(dir, m[1]!)
    if (p) out.add(p)
  }
  return [...out]
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

/** A row whose body was written gets its page flag (hasDoc), like a row page made in the app. */
async function markRowPage(dbId: string, rowId: string) {
  const { docs, release } = await openDatabase(dbId)
  try {
    updateRow(docs, rowId, { hasDoc: true })
  } finally {
    release()
  }
}

type ImportedDb = {
  dbId: string
  folder: string
  header: string[]
  records: string[][]
  rowIds: string[]
  titles: Set<string>
  rowOf: Map<string, string>
}

/**
 * Notion relation columns (M8-04, moved from M6): a column whose cells link to rows of an
 * imported database (`Task A (Task%20A%20<id>.md)` or a notion.so link) becomes a relation
 * field to that database, its cells the matching rows (by title). One-way, like Notion's
 * export (the other side's column, if exported, becomes its own relation).
 */
async function linkRelations(entries: [string, ImportedDb][]) {
  const all = entries.map(([, d]) => d)
  for (const [path, db] of entries) {
    for (let c = 1; c < db.header.length; c++) {
      const cells = db.records.map((r) => r[c] ?? '')
      const target = relationTarget(cells, dirOf(path), all)
      if (!target) continue
      const { docs, release } = await openDatabase(db.dbId)
      try {
        const name = db.header[c] || `Column ${c + 1}`
        const old = listFields(docs).find((f) => f.name === name && f.id !== readDbMeta(docs).primaryFieldId)
        if (old) deleteField(docs, old.id)
        const fieldId = addRelationField(docs, { name, targetDatabaseId: target.dbId })
        cells.forEach((cell, i) => {
          const ids = parseRelationCell(cell)
            .map((e) => target.rowOf.get(e.name))
            .filter((x): x is string => !!x)
          const rowId = db.rowIds[i]
          if (rowId && ids.length) setRelation(docs, rowId, fieldId, ids)
        })
      } finally {
        release()
      }
    }
  }
}

/** Notion row pages repeat the row's properties under the title ("Status: Done"): dropped, the CSV has them. */
export function stripNotionProperties(md: string): string {
  const lines = md.split('\n')
  let i = 0
  while (i < lines.length && !lines[i]!.trim()) i++
  let j = i
  while (j < lines.length && /^[^:\n#>*\-|`]{1,60}: /.test(lines[j]!)) j++
  return j > i ? lines.slice(j).join('\n') : md
}

async function importTree(
  zip: Map<string, Uint8Array>,
  opts: { pages: RegExp; spaceName: string; dated?: boolean },
): Promise<ImportResult> {
  const text = (p: string) => decodeText(zip.get(p)!)
  const plan = linkParents(planNotionImport([...zip.keys()], opts.pages), (p) =>
    /\.(md|markdown)$/i.test(p) ? text(p) : '',
  )
  if (!plan.length) throw new Error(it('io.nothing'))
  // a Markdown page's front matter title wins over its file name
  for (const item of plan)
    if (item.kind === 'page' && /\.(md|markdown)$/i.test(item.path)) {
      const t = frontMatter(text(item.path)).title
      if (t) item.title = t
    }
  const [io, { markdownToHtml }] = await Promise.all([loadDocIO(), loadMarkdown()])
  const day = new Date().toISOString().slice(0, 10)
  const spaceId = createSpace(ws(), { name: opts.dated === false ? opts.spaceName : `${opts.spaceName} ${day}` })
  const viewOf = new Map<string, string>()
  // imported databases: their rows by title, for relations and row pages (M8-04)
  const dbs = new Map<string, ImportedDb>()
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
        const primary = readDbMeta(docs).primaryFieldId
        const rowIds = listRows(docs).map((r) => r.id)
        const rowOf = new Map<string, string>()
        listRows(docs).forEach((r) => {
          const title = String(r.cells[primary] ?? '').trim()
          if (title && !rowOf.has(title)) rowOf.set(title, r.id)
        })
        dbs.set(item.path, { dbId, folder: item.folder, header, records, rowIds, titles: new Set(rowOf.keys()), rowOf })
        viewOf.set(item.path, viewId)
        databases++
      } finally {
        release()
      }
      continue
    }
    // a database row: its body becomes the row page (M8-04); a row page with no matching
    // row (renamed) stays a child page, and an empty body is nothing
    if (item.parent && dbOf(item.parent)) {
      const md = text(item.path).replace(/^#\s+.*\n?/, '')
      if (!stripNotionProperties(md).trim()) continue
      if (dbs.get(item.parent)?.rowOf.has(item.title)) continue
    }
    viewOf.set(item.path, createView(ws(), { parentId, spaceId, title: item.title }))
  }
  await linkRelations([...dbs.entries()])
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
    const rowDb = item.parent ? dbs.get(item.parent) : undefined
    const rowId = rowDb && !viewOf.has(item.path) ? rowDb.rowOf.get(item.title) : undefined
    const viewId = viewOf.get(item.path)
    if (!viewId && !rowId) continue
    const docName = rowId ? rowDocName(rowDb!.dbId, rowId) : pageDocName(viewId!)
    const dir = dirOf(item.path)
    const store = async (paths: string[]) => {
      for (const path of paths) {
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
    }
    if (/\.txt$/i.test(item.path)) {
      await withDoc(docName, (doc) => io.htmlIntoDoc(doc, textToHtml(text(item.path))))
      pages++
      continue
    }
    if (/\.html?$/i.test(item.path)) {
      const html = text(item.path)
      await store(htmlAttachments(html, dir))
      const body = htmlFileToHtml(html, dir, (p) => fileIds.get(p) ?? null)
      await withDoc(docName, (doc) => io.htmlIntoDoc(doc, body))
      pages++
      continue
    }
    let md = frontMatter(text(item.path)).body
    if (item.parent && dbOf(item.parent)) {
      const m = md.match(/^#\s+.*\n?/)
      md = (m ? m[0] : '') + stripNotionProperties(md.slice(m ? m[0].length : 0))
    }
    await store(attachmentsOf(md, dir))
    const html = markdownToHtml(
      rewriteNotionMarkdown(md, item.title, {
        dir,
        page: (p) => viewOf.get(p) ?? null,
        file: (p) => fileIds.get(p) ?? null,
        child: (p) => {
          const target = plan.find((x) => x.path === p || x.path === p.replace(/(?<!_all)\.csv$/i, '_all.csv'))
          return target?.parent === item.path
        },
      }),
    )
    await withDoc(docName, (doc) => io.htmlIntoDoc(doc, html))
    if (rowId) await markRowPage(rowDb!.dbId, rowId)
    pages++
  }
  const first = plan.find((i) => !i.parent)
  return { spaceId, firstViewId: first ? (viewOf.get(first.path) ?? null) : null, pages, databases, skipped }
}
