import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'
import * as Y from 'yjs'
import { assertWritable } from './guard'

export { ReadOnlyError } from './guard'

/**
 * Pure operations on the workspace Y.Doc (schema v2, spec/02 §2). Each view and space is
 * its own Y.Map, so concurrent edits to different fields merge field by field.
 * Siblings sort by (order, id); order keys are FracKeys (spec/02 §5).
 */

export type IconValue =
  { type: 'emoji'; value: string } | { type: 'icon'; value: string; color?: string } | { type: 'file'; value: string }

export type ViewKind = 'document' | 'database'
export type ViewLayout = 'document' | 'grid' | 'board' | 'calendar'

export interface ViewMeta {
  id: string
  kind: ViewKind
  layout: ViewLayout
  /** kind=database: the database the view shows (M5-01: several views may share one). */
  databaseId: string | null
  /** An inline database view inside a document (M5-10): not in the sidebar. */
  embedded: boolean
  title: string
  icon: IconValue | null
  /** Parent view, or null when the view sits directly in a space. */
  parentId: string | null
  /** The space the view belongs to (through its ancestors); '' if it lost its space. */
  spaceId: string
  /** FracKey among siblings. */
  order: string
  /** In the current user's favorites. */
  favorite: boolean
  locked: boolean
  createdAt: number
  createdBy: string
  updatedAt: number
  updatedBy: string
  deletedAt: number | null
  deletedBy: string | null
}

export interface SpaceMeta {
  id: string
  name: string
  icon: IconValue | null
  color: string
  order: string
  visibility: 'shared' | 'private'
  ownerLogin: string | null
  createdAt: number
}

type YMap = Y.Map<unknown>

/** Space created by migration v2 for existing pages. */
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

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 14)
}

const cmpKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
export const bySiblingOrder = (a: { order: string; id: string }, b: { order: string; id: string }) =>
  cmpKey(a.order, b.order) || cmpKey(a.id, b.id)

// ---------- per-user favorites ----------

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

/** Current user's favorites in their order (ids may point to deleted views). */
export function listFavoriteIds(doc: Y.Doc): string[] {
  const favs = favoritesOf(doc, false)
  if (!favs) return []
  return [...favs.entries()]
    .map(([id, order]) => ({ id, order: typeof order === 'string' ? order : '' }))
    .sort(bySiblingOrder)
    .map((f) => f.id)
}

/** Moves a favorite to `index` among the given visible favorite ids. */
export function moveFavorite(doc: Y.Doc, id: string, visibleIds: string[], index: number) {
  assertWritable()
  const favs = favoritesOf(doc, false)
  if (!favs?.has(id)) return
  doc.transact(() => {
    const rest = visibleIds.filter((f) => f !== id && favs.has(f))
    let keys = rest.map((f) => favs.get(f) ?? '')
    if (new Set(keys).size !== keys.length || keys.some((k) => !k)) {
      keys = generateNKeysBetween(null, null, rest.length)
      rest.forEach((f, i) => favs.set(f, keys[i]!))
    }
    favs.set(id, generateKeyBetween(keys[index - 1] ?? null, keys[index] ?? null))
  })
}

/**
 * Merges another user key's favorites into the current user's (spec/02 §8): used when a
 * GitHub login becomes known and the device had favorites under `local`.
 */
export function adoptFavorites(doc: Y.Doc, fromUser: string) {
  if (fromUser === currentUser) return
  const from = usersOf(doc).get(fromUser)?.get('favorites')
  if (!(from instanceof Y.Map) || from.size === 0) return
  assertWritable()
  doc.transact(() => {
    const favs = favoritesOf(doc, true)
    let last = maxValue(favs)
    const ids = [...(from as Y.Map<string>).entries()]
      .map(([id, order]) => ({ id, order: String(order) }))
      .sort(bySiblingOrder)
    for (const { id } of ids) {
      if (favs.has(id)) continue
      last = generateKeyBetween(last, null)
      favs.set(id, last)
    }
  })
}

function maxValue(map: Y.Map<string>): string | null {
  let max: string | null = null
  map.forEach((k) => {
    if (typeof k === 'string' && (max === null || k > max)) max = k
  })
  return max
}

// ---------- reading views ----------

const isListed = (m: YMap) =>
  m.get('embedded') !== true && (m.get('kind') === 'document' || m.get('kind') === 'database')

function readIcon(icon: unknown): IconValue | null {
  if (!icon || typeof icon !== 'object') return null
  const v = icon as IconValue
  return (v.type === 'emoji' || v.type === 'icon' || v.type === 'file') && typeof v.value === 'string' ? v : null
}

/** Resolves each view's space through its ancestors, cycle-safe (spec/02 §2). */
function resolveSpaces(doc: Y.Doc): Map<string, string> {
  const views = viewsOf(doc)
  const spaces = spacesOf(doc)
  const out = new Map<string, string>()
  const resolve = (id: string): string => {
    const known = out.get(id)
    if (known !== undefined) return known
    const seen: string[] = []
    let cur: string | undefined = id
    let space = ''
    while (cur !== undefined) {
      if (out.has(cur)) {
        space = out.get(cur)!
        break
      }
      if (seen.includes(cur)) break // cycle: no space
      seen.push(cur)
      const parent: unknown = views.get(cur)?.get('parentId')
      if (typeof parent !== 'string') break
      if (spaces.has(parent)) {
        space = parent
        break
      }
      cur = views.has(parent) ? parent : undefined
    }
    for (const s of seen) out.set(s, space)
    return space
  }
  views.forEach((_m, id) => resolve(id))
  return out
}

function toMeta(doc: Y.Doc, id: string, m: YMap, spaceIds: Map<string, string>, favs?: Y.Map<string>): ViewMeta {
  const parent = m.get('parentId')
  const str = (k: string) => (typeof m.get(k) === 'string' ? (m.get(k) as string) : '')
  const num = (k: string) => (typeof m.get(k) === 'number' ? (m.get(k) as number) : 0)
  return {
    id,
    kind: m.get('kind') === 'database' ? 'database' : 'document',
    layout: (str('layout') || 'document') as ViewLayout,
    databaseId: str('databaseId') || null,
    embedded: m.get('embedded') === true,
    title: str('title'),
    icon: readIcon(m.get('icon')),
    parentId: typeof parent === 'string' && viewsOf(doc).has(parent) ? parent : null,
    spaceId: spaceIds.get(id) ?? '',
    order: str('order'),
    favorite: favs?.has(id) ?? false,
    locked: m.get('locked') === true,
    createdAt: num('createdAt'),
    createdBy: str('createdBy'),
    updatedAt: num('updatedAt'),
    updatedBy: str('updatedBy'),
    deletedAt: typeof m.get('deletedAt') === 'number' ? (m.get('deletedAt') as number) : null,
    deletedBy: typeof m.get('deletedBy') === 'string' ? (m.get('deletedBy') as string) : null,
  }
}

/** Every sidebar view (documents and databases, not embedded), sorted by (order, id). */
export function listViews(doc: Y.Doc): ViewMeta[] {
  const spaceIds = resolveSpaces(doc)
  const favs = favoritesOf(doc, false)
  const out: ViewMeta[] = []
  viewsOf(doc).forEach((m, id) => {
    if (isListed(m)) out.push(toMeta(doc, id, m, spaceIds, favs))
  })
  return out.sort(bySiblingOrder)
}

/** A view by id — inline (embedded) database views included, so they open as pages too. */
export function getView(doc: Y.Doc, id: string): ViewMeta | null {
  const m = viewsOf(doc).get(id)
  const known = m && (m.get('kind') === 'document' || m.get('kind') === 'database')
  return known ? toMeta(doc, id, m, resolveSpaces(doc), favoritesOf(doc, false)) : null
}

// ---------- spaces ----------

export function listSpaces(doc: Y.Doc): SpaceMeta[] {
  const out: SpaceMeta[] = []
  spacesOf(doc).forEach((m, id) =>
    out.push({
      id,
      name: typeof m.get('name') === 'string' ? (m.get('name') as string) : '',
      icon: readIcon(m.get('icon')),
      color: typeof m.get('color') === 'string' ? (m.get('color') as string) : '',
      order: typeof m.get('order') === 'string' ? (m.get('order') as string) : '',
      visibility: m.get('visibility') === 'private' ? 'private' : 'shared',
      ownerLogin: typeof m.get('ownerLogin') === 'string' ? (m.get('ownerLogin') as string) : null,
      createdAt: typeof m.get('createdAt') === 'number' ? (m.get('createdAt') as number) : 0,
    }),
  )
  return out.sort(bySiblingOrder)
}

/** Spaces the current user sees: shared ones and their own private ones (a display filter, WS-02). */
export const visibleSpaces = (spaces: SpaceMeta[]) =>
  spaces.filter((s) => s.visibility === 'shared' || s.ownerLogin === currentUser)

/** The first space by (order, id), else the default id. */
export function rootSpaceId(doc: Y.Doc): string {
  return visibleSpaces(listSpaces(doc))[0]?.id ?? listSpaces(doc)[0]?.id ?? DEFAULT_SPACE_ID
}

export function createSpace(
  doc: Y.Doc,
  opts: { name: string; icon?: IconValue | null; color?: string; visibility?: 'shared' | 'private'; id?: string },
): string {
  assertWritable()
  const id = opts.id ?? newId()
  const last = listSpaces(doc).at(-1)?.order || null
  doc.transact(() => {
    const m = new Y.Map<unknown>()
    m.set('name', opts.name)
    m.set('icon', opts.icon ?? null)
    m.set('color', opts.color ?? 'blue')
    m.set('order', generateKeyBetween(last, null))
    m.set('visibility', opts.visibility ?? 'shared')
    m.set('ownerLogin', opts.visibility === 'private' ? currentUser : null)
    m.set('createdAt', Date.now())
    spacesOf(doc).set(id, m)
  })
  return id
}

export function updateSpace(
  doc: Y.Doc,
  id: string,
  patch: Partial<Pick<SpaceMeta, 'name' | 'icon' | 'color' | 'visibility'>>,
) {
  assertWritable()
  const m = spacesOf(doc).get(id)
  if (!m) return
  doc.transact(() => {
    for (const [k, v] of Object.entries(patch)) if (m.get(k) !== v) m.set(k, v)
    if (patch.visibility) m.set('ownerLogin', patch.visibility === 'private' ? currentUser : null)
  })
}

export function moveSpace(doc: Y.Doc, id: string, index: number) {
  assertWritable()
  doc.transact(() => {
    let rest = listSpaces(doc).filter((s) => s.id !== id)
    if (hasDuplicateKeys(rest)) {
      const keys = generateNKeysBetween(null, null, rest.length)
      rest.forEach((s, i) => spacesOf(doc).get(s.id)!.set('order', keys[i]))
      rest = listSpaces(doc).filter((s) => s.id !== id)
    }
    spacesOf(doc)
      .get(id)
      ?.set('order', generateKeyBetween(rest[index - 1]?.order || null, rest[index]?.order || null))
  })
}

/** Deletes a space; its views go to the trash (WS-02). Refuses to delete the last space. */
export function deleteSpace(doc: Y.Doc, id: string): boolean {
  assertWritable()
  if (listSpaces(doc).length <= 1) return false
  const now = Date.now()
  doc.transact(() => {
    viewsOf(doc).forEach((m) => {
      if (m.get('parentId') === id && m.get('deletedAt') == null) {
        m.set('deletedAt', now)
        m.set('deletedBy', currentUser)
      }
    })
    spacesOf(doc).delete(id)
  })
  return true
}

// ---------- writing views ----------

function hasDuplicateKeys(items: { order: string }[]) {
  const keys = items.map((i) => i.order)
  return keys.some((k) => !k) || new Set(keys).size !== keys.length
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

/** Order key right after `afterId` among its siblings, or at the end. */
function keyAfter(doc: Y.Doc, storedParent: string, afterId?: string): string {
  const sibs = siblingsOf(doc, storedParent)
  const i = afterId ? sibs.findIndex((s) => s.id === afterId) : -1
  if (i < 0) return generateKeyBetween(sibs.at(-1)?.order || null, null)
  const next = sibs[i + 1]
  const a = sibs[i]!.order || null
  const b = next?.order || null
  return b !== null && a !== null && a >= b ? generateKeyBetween(a, null) : generateKeyBetween(a, b)
}

export interface CreateViewOptions {
  /** Parent view; omitted/null = directly in `spaceId` (default: the first space). */
  parentId?: string | null
  spaceId?: string
  title?: string
  icon?: IconValue | null
  kind?: ViewKind
  layout?: ViewLayout
  databaseId?: string | null
  /** Inline database view (M5-10): hidden from the sidebar. */
  embedded?: boolean
  /** Insert right after this sibling instead of at the end. */
  after?: string
  id?: string
}

export function createView(doc: Y.Doc, opts: CreateViewOptions = {}): string {
  assertWritable()
  const id = opts.id ?? newId()
  const parent = opts.parentId ?? opts.spaceId ?? rootSpaceId(doc)
  const now = Date.now()
  doc.transact(() => {
    const m = new Y.Map<unknown>()
    m.set('kind', opts.kind ?? 'document')
    m.set('layout', opts.layout ?? 'document')
    m.set('databaseId', opts.databaseId ?? null)
    m.set('parentId', parent)
    m.set('order', keyAfter(doc, parent, opts.after))
    m.set('title', opts.title ?? '')
    m.set('icon', opts.icon ?? null)
    m.set('embedded', opts.embedded === true)
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

export type ViewPatch = Partial<Pick<ViewMeta, 'title' | 'icon' | 'locked' | 'favorite' | 'deletedAt'>>

export function updateView(doc: Y.Doc, id: string, patch: ViewPatch) {
  assertWritable()
  const m = viewsOf(doc).get(id)
  if (!m) return
  doc.transact(() => {
    let changed = false
    for (const [k, v] of Object.entries(patch) as [keyof ViewPatch, unknown][]) {
      if (k === 'favorite') {
        if (v) {
          const favs = favoritesOf(doc, true)
          if (!favs.has(id)) favs.set(id, generateKeyBetween(maxValue(favs), null))
        } else favoritesOf(doc, false)?.delete(id)
        continue // per-user state: not a change to the view
      }
      if (k === 'icon' && JSON.stringify(m.get('icon') ?? null) === JSON.stringify(v ?? null)) continue
      if (m.get(k) === v) continue
      if (k === 'deletedAt') m.set('deletedBy', v == null ? null : currentUser)
      m.set(k, v)
      changed = true
    }
    if (changed) {
      m.set('updatedAt', Date.now())
      m.set('updatedBy', currentUser)
    }
  })
}

export function trashView(doc: Y.Doc, id: string) {
  updateView(doc, id, { deletedAt: Date.now() })
}

export function restoreView(doc: Y.Doc, id: string) {
  const m = viewsOf(doc).get(id)
  if (!m) return
  assertWritable()
  doc.transact(() => {
    const parent = m.get('parentId')
    const parentOk = typeof parent === 'string' && (viewsOf(doc).has(parent) || spacesOf(doc).has(parent))
    if (!parentOk) {
      const root = rootSpaceId(doc)
      m.set('parentId', root)
      m.set('order', keyAfter(doc, root))
    }
    updateView(doc, id, { deletedAt: null })
  })
}

export function descendantsOf(views: { id: string; parentId: string | null }[], id: string): string[] {
  const children = new Map<string, string[]>()
  for (const v of views) if (v.parentId) children.set(v.parentId, [...(children.get(v.parentId) ?? []), v.id])
  const out: string[] = []
  const seen = new Set([id])
  const walk = (pid: string) => {
    for (const c of children.get(pid) ?? []) {
      if (seen.has(c)) continue
      seen.add(c)
      out.push(c)
      walk(c)
    }
  }
  walk(id)
  return out
}

/** Ancestors from the root down, starting at `parentId` (cycle-safe). */
export function ancestorsOf<T extends { id: string; parentId: string | null }>(
  views: T[],
  parentId: string | null,
): T[] {
  const byId = new Map(views.map((p) => [p.id, p]))
  const out: T[] = []
  const seen = new Set<string>()
  let cur = parentId ? byId.get(parentId) : undefined
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    out.unshift(cur)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return out
}

/** Visible if neither the view nor any ancestor is in the trash, and it still has a space. */
export function isAlive(views: Map<string, ViewMeta>, id: string): boolean {
  let cur = views.get(id)
  const seen = new Set<string>()
  while (cur) {
    if (cur.deletedAt || seen.has(cur.id)) return false
    seen.add(cur.id)
    if (!cur.parentId) return cur.spaceId !== ''
    cur = views.get(cur.parentId)
  }
  return false
}

/**
 * Removes a view and all of its descendants (and their favorites). Returns removed ids.
 * Also drops the frozen v1 `pages` entry, or migration v2 would treat it as a leftover
 * and bring the page back.
 */
export function deleteViewPermanently(doc: Y.Doc, id: string): string[] {
  assertWritable()
  const ids = [id, ...descendantsOf(listViews(doc), id)]
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

/**
 * Moves `id` to `index` among the live children of `parentId` (a view) or, when null,
 * of `spaceId`. Refuses to move a view into itself or its descendants.
 */
export function moveView(doc: Y.Doc, id: string, to: { parentId: string | null; spaceId?: string; index: number }) {
  assertWritable()
  const m = viewsOf(doc).get(id)
  if (!m) return false
  const all = listViews(doc)
  if (to.parentId && (to.parentId === id || descendantsOf(all, id).includes(to.parentId))) return false
  const stored = to.parentId ?? to.spaceId ?? rootSpaceId(doc)
  doc.transact(() => {
    let live = siblingsOf(doc, stored, id).filter((s) => !s.deleted)
    // Equal keys (concurrent inserts) leave no room between them: re-key the group (spec/02 §5).
    if (hasDuplicateKeys(live)) {
      const keys = generateNKeysBetween(null, null, live.length)
      live.forEach((s, i) => viewsOf(doc).get(s.id)!.set('order', keys[i]))
      live = siblingsOf(doc, stored, id).filter((s) => !s.deleted)
    }
    const i = Math.max(0, Math.min(to.index, live.length))
    m.set('parentId', stored)
    m.set('order', generateKeyBetween(live[i - 1]?.order || null, live[i]?.order || null))
    m.set('updatedAt', Date.now())
    m.set('updatedBy', currentUser)
  })
  return true
}

/** Copies a view's metadata (not its content) right after it. Returns the new id. */
export function duplicateViewMeta(doc: Y.Doc, id: string, title: string): string | null {
  const src = viewsOf(doc).get(id)
  if (!src) return null
  return createView(doc, {
    parentId: src.get('parentId') as string,
    title,
    icon: readIcon(src.get('icon')),
    kind: src.get('kind') === 'database' ? 'database' : 'document',
    layout: (src.get('layout') as ViewLayout) ?? 'document',
    databaseId: (src.get('databaseId') as string | null) ?? null,
    after: id,
  })
}

/** Database id a (database) view points at, or null. */
export function databaseIdOf(doc: Y.Doc, viewId: string): string | null {
  const id = viewsOf(doc).get(viewId)?.get('databaseId')
  return typeof id === 'string' && id ? id : null
}

/** Every database some view (trashed ones included) still points at. */
export function referencedDatabaseIds(doc: Y.Doc): Set<string> {
  const out = new Set<string>()
  viewsOf(doc).forEach((m) => {
    const id = m.get('databaseId')
    if (typeof id === 'string' && id) out.add(id)
  })
  return out
}
