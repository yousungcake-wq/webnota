/**
 * Reading a Notion export ("Markdown & CSV" zip, feedback 11). Notion names every page
 * `Title <32 hex>.md`, puts its sub-pages and attachments in a folder of the same name,
 * writes databases as `Title <hex>.csv` (plus `_all.csv` with every row) and their row
 * pages in `Title <hex>/`. Pure helpers: the importer feeds them the zip's paths.
 */

export interface NotionItem {
  /** Path of the `.md` / `.csv` file. */
  path: string
  title: string
  kind: 'page' | 'database'
  /** Folder of children (sub-pages, rows, attachments): the path without extension. */
  folder: string
  /** Parent item's path, or null at the top. */
  parent: string | null
}

const HEX = /\s+[0-9a-f]{32}$/i
const SHORT_HEX = /\s+[0-9a-f]{12,}$/i

/** "Meeting notes 1f0a…e2.md" → "Meeting notes". */
export function notionTitle(fileName: string): string {
  const base = fileName.replace(/\.(md|csv)$/i, '').replace(/_all$/, '')
  return base.replace(HEX, '').replace(SHORT_HEX, '').trim() || base
}

const dirOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
const nameOf = (p: string) => p.slice(p.lastIndexOf('/') + 1)

/** The pages and databases of an export, parents before children. */
export function planNotionImport(paths: string[]): NotionItem[] {
  const files = paths.filter((p) => !p.endsWith('/'))
  const csv = files.filter((p) => /\.csv$/i.test(p))
  // a database: prefer `X_all.csv` (every row) over `X.csv` (the default view's rows)
  const dbs = new Map<string, string>()
  for (const p of csv) {
    const key = p.replace(/_all\.csv$/i, '.csv')
    if (!dbs.has(key) || /_all\.csv$/i.test(p)) dbs.set(key, p)
  }
  const items: NotionItem[] = []
  for (const p of files.filter((x) => /\.md$/i.test(x)))
    items.push({ path: p, title: notionTitle(nameOf(p)), kind: 'page', folder: p.slice(0, -3), parent: null })
  for (const [key, p] of dbs)
    items.push({ path: p, title: notionTitle(nameOf(p)), kind: 'database', folder: key.slice(0, -4), parent: null })
  const byFolder = new Map(items.map((i) => [i.folder, i]))
  for (const i of items) i.parent = byFolder.get(dirOf(i.path))?.path ?? null
  // parents first (depth order), then by path for a stable order
  const depth = (i: NotionItem): number => (i.parent ? 1 + depth(items.find((x) => x.path === i.parent)!) : 0)
  return items.sort((a, b) => depth(a) - depth(b) || a.path.localeCompare(b.path))
}

/** A relative link in a file at `fromDir`, resolved to a zip path (URL-decoded, `..` handled). */
export function resolveRelative(fromDir: string, href: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) return null
  let rel: string
  try {
    rel = decodeURIComponent(href.split('#')[0]!.split('?')[0]!)
  } catch {
    rel = href
  }
  const parts = (fromDir ? fromDir.split('/') : []).concat(rel.split('/'))
  const out: string[] = []
  for (const part of parts) {
    if (part === '..') out.pop()
    else if (part && part !== '.') out.push(part)
  }
  return out.join('/')
}

const IMAGE = /\.(png|jpe?g|gif|webp|svg|bmp|heic)$/i
const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export interface RewriteContext {
  /** Directory of the `.md` file being converted. */
  dir: string
  /** WebNota view id for an imported page or database at this zip path. */
  page(path: string): string | null
  /** Workspace file id for an attachment at this zip path (already stored). */
  file(path: string): string | null
}

/** Attachment paths a page's Markdown refers to (to store them before rewriting). */
export function attachmentsOf(md: string, dir: string): string[] {
  const out = new Set<string>()
  for (const m of md.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const p = resolveRelative(dir, m[1]!)
    if (p && !/\.(md|csv)$/i.test(p)) out.add(p)
  }
  return [...out]
}

/**
 * Notion Markdown → Markdown with inline HTML the editor's schema reads: the leading
 * `# Title` goes (it becomes the page title), links to imported pages become page
 * mentions, attachments become image / file blocks, `<aside>` becomes a callout.
 */
export function rewriteNotionMarkdown(md: string, title: string, ctx: RewriteContext): string {
  let s = md.replace(/^\uFEFF/, '')
  const firstLine = s.match(/^#\s+(.*)\n?/)
  if (firstLine && firstLine[1]!.trim() === title.trim()) s = s.slice(firstLine[0].length)
  // images on their own line → image blocks
  s = s.replace(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/gm, (all, alt: string, href: string) => {
    if (/^https?:/i.test(href)) return all
    const id = ctx.file(resolveRelative(ctx.dir, href) ?? '')
    return id ? `<figure data-image data-file="${id}"><figcaption>${escAttr(alt)}</figcaption></figure>` : all
  })
  // links: imported pages → mentions, attachments → file blocks / links
  s = s.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (all, bang: string, text: string, href: string) => {
    const path = resolveRelative(ctx.dir, href)
    if (!path) return all
    const view = /\.(md|csv)$/i.test(path) ? ctx.page(path) : null
    if (view) return `<span data-mention data-kind="page" data-view-id="${view}"></span>`
    const id = ctx.file(path)
    if (!id) return all
    if (bang || IMAGE.test(path)) return `<img data-file="${id}" alt="${escAttr(text)}">`
    return `<span data-file-link="${id}">${escAttr(text || nameOf(path))}</span>`
  })
  // a link that is alone on its line and points at a file: a file block
  s = s.replace(/^<span data-file-link="([^"]+)">([^<]*)<\/span>\s*$/gm, (_a, id: string, name: string) => {
    return `<div data-file-block data-file="${id}" data-name="${name}">${name}</div>`
  })
  s = s.replace(/<span data-file-link="[^"]+">([^<]*)<\/span>/g, '$1')
  // callouts: <aside>💡 text</aside>
  s = s.replace(/<aside>\s*([\s\S]*?)\s*<\/aside>/g, (_a, body: string) => {
    const m = body.match(/^(\p{Extended_Pictographic}️?)\s*/u)
    const icon = m ? m[1]! : '💡'
    const text = m ? body.slice(m[0].length) : body
    const paras = text
      .split(/\n{2,}/)
      .map((t) => `<p>${t.trim()}</p>`)
      .join('')
    return `<div data-type="callout" data-icon="${icon}">${paras}</div>`
  })
  return s
}
