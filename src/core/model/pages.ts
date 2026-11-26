import * as Y from 'yjs'

/**
 * Pure operations on the workspace Y.Doc. Each page's metadata is its own
 * Y.Map, so concurrent edits to different fields (title on one device,
 * favorite on another) merge field by field.
 */

export interface PageMeta {
  id: string
  title: string
  icon: string
  parentId: string | null
  order: number
  favorite: boolean
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

type MetaMap = Y.Map<unknown>

export const pagesOf = (doc: Y.Doc) => doc.getMap<MetaMap>('pages')

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 14)
}

function toMeta(id: string, m: MetaMap): PageMeta {
  return {
    id,
    title: (m.get('title') as string) ?? '',
    icon: (m.get('icon') as string) ?? '',
    parentId: (m.get('parentId') as string | null) ?? null,
    order: (m.get('order') as number) ?? 0,
    favorite: Boolean(m.get('favorite')),
    createdAt: (m.get('createdAt') as number) ?? 0,
    updatedAt: (m.get('updatedAt') as number) ?? 0,
    deletedAt: (m.get('deletedAt') as number | null) ?? null,
  }
}

export function listPages(doc: Y.Doc): PageMeta[] {
  const out: PageMeta[] = []
  pagesOf(doc).forEach((m, id) => out.push(toMeta(id, m)))
  return out.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
}

export function getPage(doc: Y.Doc, id: string): PageMeta | null {
  const m = pagesOf(doc).get(id)
  return m ? toMeta(id, m) : null
}

export function createPage(
  doc: Y.Doc,
  opts: { parentId?: string | null; title?: string; icon?: string; id?: string } = {},
): string {
  const id = opts.id ?? newId()
  const parentId = opts.parentId ?? null
  const siblings = listPages(doc).filter((p) => p.parentId === parentId)
  const order = siblings.length ? Math.max(...siblings.map((s) => s.order)) + 1 : 0
  const now = Date.now()
  doc.transact(() => {
    const m = new Y.Map<unknown>()
    m.set('title', opts.title ?? '')
    m.set('icon', opts.icon ?? '')
    m.set('parentId', parentId)
    m.set('order', order)
    m.set('favorite', false)
    m.set('createdAt', now)
    m.set('updatedAt', now)
    m.set('deletedAt', null)
    pagesOf(doc).set(id, m)
  })
  return id
}

export function updatePage(doc: Y.Doc, id: string, patch: Partial<Omit<PageMeta, 'id'>>) {
  const m = pagesOf(doc).get(id)
  if (!m) return
  doc.transact(() => {
    for (const [k, v] of Object.entries(patch)) {
      if (m.get(k) !== v) m.set(k, v)
    }
    m.set('updatedAt', Date.now())
  })
}

export function descendantsOf(pages: PageMeta[], id: string): string[] {
  const out: string[] = []
  const walk = (pid: string) => {
    for (const p of pages) {
      if (p.parentId === pid) {
        out.push(p.id)
        walk(p.id)
      }
    }
  }
  walk(id)
  return out
}

/** Ancestors of a page from the root down, starting at `parentId` (cycle-safe). */
export function ancestorsOf(pages: PageMeta[], parentId: string | null): PageMeta[] {
  const byId = new Map(pages.map((p) => [p.id, p]))
  const out: PageMeta[] = []
  const seen = new Set<string>()
  let cur = parentId ? byId.get(parentId) : undefined
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    out.unshift(cur)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return out
}

/** A page is visible if neither it nor any ancestor is in the trash. */
export function isAlive(pages: Map<string, PageMeta>, id: string): boolean {
  let cur = pages.get(id)
  const seen = new Set<string>()
  while (cur) {
    if (cur.deletedAt || seen.has(cur.id)) return false
    seen.add(cur.id)
    if (!cur.parentId) return true
    cur = pages.get(cur.parentId)
  }
  return false
}

export function trashPage(doc: Y.Doc, id: string) {
  updatePage(doc, id, { deletedAt: Date.now() })
}

export function restorePage(doc: Y.Doc, id: string) {
  const page = getPage(doc, id)
  if (!page) return
  // If the parent no longer exists, restore to the root.
  const parentOk = page.parentId ? pagesOf(doc).has(page.parentId) : true
  updatePage(doc, id, { deletedAt: null, ...(parentOk ? {} : { parentId: null }) })
}

/** Removes a page and all of its descendants. Returns removed ids. */
export function deletePagePermanently(doc: Y.Doc, id: string): string[] {
  const ids = [id, ...descendantsOf(listPages(doc), id)]
  doc.transact(() => ids.forEach((pid) => pagesOf(doc).delete(pid)))
  return ids
}

/** Moves `id` under `parentId` at position `index` among its new siblings. */
export function movePage(doc: Y.Doc, id: string, parentId: string | null, index: number) {
  const all = listPages(doc)
  if (parentId && (parentId === id || descendantsOf(all, id).includes(parentId))) return
  const siblings = all.filter((p) => p.parentId === parentId && p.id !== id && !p.deletedAt)
  const before = siblings[index - 1]
  const after = siblings[index]
  let order: number
  if (before && after) order = (before.order + after.order) / 2
  else if (before) order = before.order + 1
  else if (after) order = after.order - 1
  else order = 0
  updatePage(doc, id, { parentId, order })
}

export function displayTitle(title: string) {
  return title.trim() || '제목 없음'
}

/** "Parent / Child" breadcrumb text for list subtitles (up to 10 levels). */
export function pathOf(p: PageMeta, byId: Map<string, PageMeta>): string {
  const parts: string[] = []
  let cur = p.parentId ? byId.get(p.parentId) : undefined
  while (cur && parts.length < 10) {
    parts.unshift(displayTitle(cur.title))
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return parts.join(' / ')
}
