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
  const base = fileName.replace(/\.(md|markdown|txt|html?|csv)$/i, '').replace(/_all$/, '')
  return base.replace(HEX, '').replace(SHORT_HEX, '').trim() || base
}

const dirOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
const nameOf = (p: string) => p.slice(p.lastIndexOf('/') + 1)

/** Page files in a Notion zip; picked files may also be text and HTML (M8-01~03). */
export const NOTION_PAGES = /\.md$/i
export const FILE_PAGES = /\.(md|markdown|txt|html?)$/i

/** The pages and databases of an export, parents before children. */
export function planNotionImport(paths: string[], pages: RegExp = NOTION_PAGES): NotionItem[] {
  const files = paths.filter((p) => !p.endsWith('/'))
  const csv = files.filter((p) => /\.csv$/i.test(p))
  // a database: prefer `X_all.csv` (every row) over `X.csv` (the default view's rows)
  const dbs = new Map<string, string>()
  for (const p of csv) {
    const key = p.replace(/_all\.csv$/i, '.csv')
    if (!dbs.has(key) || /_all\.csv$/i.test(p)) dbs.set(key, p)
  }
  const items: NotionItem[] = []
  for (const p of files.filter((x) => pages.test(x)))
    items.push({
      path: p,
      title: notionTitle(nameOf(p)),
      kind: 'page',
      folder: p.replace(/\.[^./]+$/, ''),
      parent: null,
    })
  for (const [key, p] of dbs)
    items.push({ path: p, title: notionTitle(nameOf(p)), kind: 'database', folder: key.slice(0, -4), parent: null })
  // the sub-page folder is "Title <id>/" or, in newer exports, just "Title/"
  const byFolder = new Map<string, NotionItem>()
  for (const i of items) {
    const bare = `${dirOf(i.folder) ? dirOf(i.folder) + '/' : ''}${notionTitle(nameOf(i.folder) + '.md')}`
    if (!byFolder.has(bare)) byFolder.set(bare, i)
  }
  for (const i of items) byFolder.set(i.folder, i)
  const parentOf = (dir: string): NotionItem | undefined => {
    const direct = byFolder.get(dir)
    if (direct) return direct
    // a parent folder whose own name lost its id: "A/B" for "A <id>/B <id>"
    const parts = dir.split('/')
    const bare = parts.map((x) => notionTitle(x + '.md')).join('/')
    return [...byFolder.entries()].find(
      ([k]) =>
        k
          .split('/')
          .map((x) => notionTitle(x + '.md'))
          .join('/') === bare,
    )?.[1]
  }
  for (const i of items) i.parent = parentOf(dirOf(i.path))?.path ?? null
  // parents first (depth order), then by path for a stable order
  const depth = (i: NotionItem): number => (i.parent ? 1 + depth(items.find((x) => x.path === i.parent)!) : 0)
  return items.sort((a, b) => depth(a) - depth(b) || a.path.localeCompare(b.path))
}

const isAncestor = (items: NotionItem[], a: string, of: string): boolean => {
  for (let p: string | null = of; p; p = items.find((x) => x.path === p)?.parent ?? null) if (p === a) return true
  return false
}

/**
 * Exports without sub-page folders ("Create folders for subpages" off) are flat: a page's
 * parent is the page that links to it on a line of its own (Notion's child-page block).
 * Fills in `parent` for items that have none, then re-sorts parents first.
 */
export function linkParents(items: NotionItem[], read: (path: string) => string): NotionItem[] {
  const target = new Map<string, NotionItem>()
  for (const i of items) {
    target.set(i.path, i)
    if (i.kind === 'database') {
      target.set(i.path.replace(/_all\.csv$/i, '.csv'), i)
      target.set(i.path.replace(/(?<!_all)\.csv$/i, '_all.csv'), i)
    }
  }
  for (const page of items.filter((i) => i.kind === 'page')) {
    for (const href of childLinks(read(page.path))) {
      const child = target.get(resolveRelative(dirOf(page.path), href) ?? '')
      if (!child || child.parent || child === page || isAncestor(items, child.path, page.path)) continue
      child.parent = page.path
    }
  }
  const depth = (i: NotionItem): number => (i.parent ? 1 + depth(items.find((x) => x.path === i.parent)!) : 0)
  return items.sort((a, b) => depth(a) - depth(b) || a.path.localeCompare(b.path))
}

/** Links alone on their line (optionally inside an <aside> with nothing else): child pages. */
export function childLinks(md: string): string[] {
  const out: string[] = []
  for (const m of md.matchAll(/^\s*(?:<aside>\s*)?\[[^\]]*\]\(([^)\s]+\.(?:md|csv))\)\s*(?:<\/aside>)?\s*$/gim))
    out.push(m[1]!)
  return out
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
  /** True when the page at this path is a child of the page being converted (→ sub-page block). */
  child?(path: string): boolean
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
  // an <aside> that only wraps page links is not a callout: unwrap it
  s = s.replace(
    /<aside>\s*((?:\p{Extended_Pictographic}\uFE0F?\s*)?(?:\[[^\]]*\]\([^)\s]+\.(?:md|csv)\)\s*)+)<\/aside>/gu,
    (_a, body: string) =>
      body
        .replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '')
        .trim()
        .split(/\s*\n\s*/)
        .join('\n\n'),
  )
  // child pages: a link alone on its line → sub-page block
  s = s.replace(/^\[[^\]]*\]\(([^)\s]+\.(?:md|csv))\)\s*$/gm, (all, href: string) => {
    const path = resolveRelative(ctx.dir, href)
    const view = path && ctx.child?.(path) ? ctx.page(path) : null
    return view ? `<div data-sub-page data-view-id="${view}"></div>` : all
  })
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

/** One linked page in a Notion relation cell: `Task A (Task%20A%20<id>.md)` or `Task A (https://www.notion.so/…)`. */
export interface RelationEntry {
  name: string
  /** The link in parentheses (a relative `.md` path or a notion.so URL), if any. */
  link: string | null
}

/** A relation cell's entries: commas outside the parentheses separate them (M8-04). */
export function parseRelationCell(cell: string): RelationEntry[] {
  const out: RelationEntry[] = []
  let depth = 0
  let cur = ''
  const push = () => {
    const s = cur.trim()
    cur = ''
    if (!s) return
    const m = /^(.*?)\s*\(([^()]*(?:\.md|notion\.so[^()]*))\)$/i.exec(s)
    out.push(m ? { name: m[1]!.trim(), link: m[2]! } : { name: s, link: null })
  }
  for (const ch of cell) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) push()
    else cur += ch
  }
  push()
  return out
}

/**
 * Which database a relation column points at: the one holding the rows its relative
 * links lead to, else the one whose row titles match most of its names. Null when this
 * does not look like a relation (no links, or fewer than half of the names match).
 */
export function relationTarget<T extends { folder: string; titles: Set<string> }>(
  cells: string[],
  fromDir: string,
  dbs: T[],
): T | null {
  const entries = cells.flatMap(parseRelationCell)
  if (!entries.length || !entries.some((e) => e.link)) return null
  const bare = (p: string) =>
    p
      .split('/')
      .map((x) => notionTitle(x + '.md'))
      .join('/')
  for (const e of entries) {
    if (!e.link || !/\.md$/i.test(e.link)) continue
    const path = resolveRelative(fromDir, e.link)
    const db = path ? dbs.find((d) => bare(d.folder) === bare(dirOf(path))) : undefined
    if (db) return db
  }
  let best: T | null = null
  let score = 0
  for (const db of dbs) {
    const hits = entries.filter((e) => db.titles.has(e.name)).length
    if (hits > score) [best, score] = [db, hits]
  }
  return best && score * 2 >= entries.length ? best : null
}
