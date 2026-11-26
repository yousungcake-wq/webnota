import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'
import * as Y from 'yjs'
import { assertWritable } from './guard'

export { ReadOnlyError } from './guard'

/**
 * Pure operations on the workspace Y.Doc (schema v2, spec/02 §2). Each view is its own
 * Y.Map, so concurrent edits to different fields merge field by field.
 */

/**
 * A document view as the current UI sees it (spec/02 §2 `views`, kind=document).
 * Spaces are not in the UI yet (M1): a view whose parent is a space has `parentId: null`.
 * `icon` is the emoji value ('' when none or not an emoji); `favorite` is the current
 * user's favorite.
 */
export interface PageMeta {
  id: string
  title: string
  icon: string
  parentId: string | null
  /** FracKey; siblings sort by (order, id). */
  order: string
  favorite: boolean
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

type YMap = Y.Map<unknown>

export type IconValue =
  { type: 'emoji'; value: string } | { type: 'icon'; value: string; color?: string } | { type: 'file'; value: string }

/** Space created by migration v2 for existing pages; new roots go to the first space. */
export const DEFAULT_SPACE_ID = 'default'

let currentUser = 'local'
/** User key for per-user state (spec/02 §8). Until a GitHub login is tracked this is `local`. */
export const getCurrentUser = () => currentUser
export function setCurrentUser(login: string) {
  currentUser = login
}

export const viewsOf = (doc: Y.Doc) => doc.getMap<YMap>('views')
export const spacesOf = (doc: Y.Doc) => doc.getMap<YMap>('spaces')
const usersOf = (doc: Y.Doc) => doc.getMap<YMap>('users')

function favoritesOf(doc: Y.Doc, create: false): Y.Map<string> | undefined
function favoritesOf(doc: Y.Doc, create: true): Y.Map<string>
function favoritesOf(doc: Y.Doc, create: boolean): Y.Map<string> | undefined {
  const users = usersOf(doc)
  let user = users.get(currentUser)
  if (!(user instanceof Y.Map)) {
    if (!create) return undefined
    user = new Y.Map<unknown>()
    users.set(currentUser, user)
  }
  let favs = user.get('favorites')
  if (!(favs instanceof Y.Map)) {
    if (!create) return undefined
    favs = new Y.Map<string>()
    user.set('favorites', favs)
  }
  return favs as Y.Map<string>
}

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 14)
}

const cmpKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const bySiblingOrder = (a: { order: string; id: string }, b: { order: string; id: string }) =>
  cmpKey(a.order, b.order) || cmpKey(a.id, b.id)

const isDocumentView = (m: YMap) => m.get('kind') === 'document' && m.get('embedded') !== true

function emojiOf(icon: unknown): string {
  return icon && typeof icon === 'object' && (icon as IconValue).type === 'emoji' ? (icon as IconValue).value : ''
}

function toMeta(doc: Y.Doc, id: string, m: YMap, favs: Y.Map<string> | undefined): PageMeta {
  const parent = m.get('parentId')
  return {
    id,
    title: (m.get('title') as string) ?? '',
    icon: emojiOf(m.get('icon')),
    parentId: typeof parent === 'string' && !spacesOf(doc).has(parent) ? parent : null,
    order: (m.get('order') as string) ?? '',
    favorite: favs?.has(id) ?? false,
    createdAt: (m.get('createdAt') as number) ?? 0,
    updatedAt: (m.get('updatedAt') as number) ?? 0,
    deletedAt: (m.get('deletedAt') as number | null) ?? null,
  }
}

export function listPages(doc: Y.Doc): PageMeta[] {
  const out: PageMeta[] = []
  const favs = favoritesOf(doc, false)
  viewsOf(doc).forEach((m, id) => {
    if (isDocumentView(m)) out.push(toMeta(doc, id, m, favs))
  })
  return out.sort(bySiblingOrder)
}

export function getPage(doc: Y.Doc, id: string): PageMeta | null {
  const m = viewsOf(doc).get(id)
  return m && isDocumentView(m) ? toMeta(doc, id, m, favoritesOf(doc, false)) : null
}

/** The space new root pages go into: the first by (order, id), else the default id. */
export function rootSpaceId(doc: Y.Doc): string {
  const spaces: { id: string; order: string }[] = []
  spacesOf(doc).forEach((m, id) => spaces.push({ id, order: (m.get('order') as string) ?? '' }))
  return spaces.sort(bySiblingOrder)[0]?.id ?? DEFAULT_SPACE_ID
}

/** Raw sibling list of a stored parent id (space or view), sorted. */
function siblingsOf(doc: Y.Doc, storedParent: string, exclude?: string) {
  const out: { id: string; order: string; deleted: boolean }[] = []
  viewsOf(doc).forEach((m, id) => {
    if (id !== exclude && m.get('parentId') === storedParent)
      out.push({ id, order: (m.get('order') as string) ?? '', deleted: m.get('deletedAt') != null })
  })
  return out.sort(bySiblingOrder)
}

/** Order key for a new last child of `storedParent`. */
function keyAtEnd(doc: Y.Doc, storedParent: string): string {
  const sibs = siblingsOf(doc, storedParent)
  return generateKeyBetween(sibs.at(-1)?.order || null, null)
}

export function createPage(
  doc: Y.Doc,
  opts: { parentId?: string | null; title?: string; icon?: string; id?: string } = {},
): string {
  assertWritable()
  const id = opts.id ?? newId()
  const parent = opts.parentId ?? rootSpaceId(doc)
  const now = Date.now()
  doc.transact(() => {
    const m = new Y.Map<unknown>()
    m.set('kind', 'document')
    m.set('layout', 'document')
    m.set('databaseId', null)
    m.set('parentId', parent)
    m.set('order', keyAtEnd(doc, parent))
    m.set('title', opts.title ?? '')
    m.set('icon', opts.icon ? { type: 'emoji', value: opts.icon } : null)
    m.set('embedded', false)
    m.set('locked', false)
    m.set('createdAt', now)
    m.set('createdBy', currentUser)
    m.set('updatedAt', now)
    m.set('updatedBy', currentUser)
    m.set('deletedAt', null)
    m.set('deletedBy', null)
    viewsOf(doc).set(id, m)
  })
  return id
}

export function updatePage(doc: Y.Doc, id: string, patch: Partial<Omit<PageMeta, 'id'>>) {
  assertWritable()
  const m = viewsOf(doc).get(id)
  if (!m) return
  doc.transact(() => {
    for (const [k, v] of Object.entries(patch) as [keyof PageMeta, unknown][]) {
      if (k === 'favorite') {
        if (v) {
          const favs = favoritesOf(doc, true)
          if (!favs.has(id)) favs.set(id, generateKeyBetween(maxValue(favs), null))
        } else favoritesOf(doc, false)?.delete(id)
        continue
      }
      let value = v
      if (k === 'icon') {
        if (emojiOf(m.get('icon')) === v) continue
        value = v ? { type: 'emoji', value: v } : null
      } else if (k === 'parentId') value = v ?? rootSpaceId(doc)
      else if (k === 'deletedAt') m.set('deletedBy', v == null ? null : currentUser)
      if (m.get(k) !== value) m.set(k, value)
    }
    m.set('updatedAt', Date.now())
    m.set('updatedBy', currentUser)
  })
}

function maxValue(map: Y.Map<string>): string | null {
  let max: string | null = null
  map.forEach((k) => {
    if (typeof k === 'string' && (max === null || k > max)) max = k
  })
  return max
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
  const parentOk = page.parentId ? viewsOf(doc).has(page.parentId) : true
  updatePage(doc, id, { deletedAt: null, ...(parentOk ? {} : { parentId: null }) })
}

/**
 * Removes a page and all of its descendants (and their favorites). Returns removed ids.
 * Also drops the frozen v1 `pages` entry, or migration v2 would treat it as a leftover
 * and bring the page back.
 */
export function deletePagePermanently(doc: Y.Doc, id: string): string[] {
  assertWritable()
  const ids = [id, ...descendantsOf(listPages(doc), id)]
  doc.transact(() => {
    ids.forEach((pid) => viewsOf(doc).delete(pid))
    const legacy = doc.share.has('pages') ? doc.getMap('pages') : null
    if (legacy) ids.forEach((pid) => legacy.has(pid) && legacy.delete(pid))
    usersOf(doc).forEach((user) => {
      const favs = user instanceof Y.Map ? user.get('favorites') : null
      if (favs instanceof Y.Map) ids.forEach((pid) => favs.has(pid) && favs.delete(pid))
    })
  })
  return ids
}

/** Moves `id` under `parentId` (null = root) at position `index` among its live new siblings. */
export function movePage(doc: Y.Doc, id: string, parentId: string | null, index: number) {
  assertWritable()
  const all = listPages(doc)
  if (parentId && (parentId === id || descendantsOf(all, id).includes(parentId))) return
  const stored = parentId ?? rootSpaceId(doc)
  doc.transact(() => {
    let live = siblingsOf(doc, stored, id).filter((s) => !s.deleted)
    const before = live[index - 1]
    const after = live[index]
    // Equal keys (concurrent inserts) leave no room between them: re-key the group (spec/02 §5).
    if (before && after && before.order >= after.order) {
      const keys = generateNKeysBetween(null, null, live.length)
      live.forEach((s, i) => viewsOf(doc).get(s.id)!.set('order', keys[i]))
      live = siblingsOf(doc, stored, id).filter((s) => !s.deleted)
    }
    const order = generateKeyBetween(live[index - 1]?.order || null, live[index]?.order || null)
    updatePage(doc, id, { parentId, order })
  })
}
