import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'
import * as Y from 'yjs'
import type { Migration } from '../migrate'
import { v2Leftover } from './002-views.leftover'

/**
 * v1 → v2 (spec/02 §7):
 * - `pages` (PoC) → `views` (kind/layout document), same IDs
 * - numeric `order` → FracKey, keeping sibling order (order, then createdAt)
 * - `favorite` → `users.local.favorites` (no login is known to a migration; spec/02 §8)
 * - a default space; root (or orphaned) pages move into it
 * - `pages` is KEPT as a frozen copy. A v1 app (an old cached PWA on another device)
 *   has no schema gate and its sync engine deletes the repository files of every page
 *   missing from `pages` — emptying it would wipe all page files from GitHub.
 *   Permanent deletes in v2 remove the legacy entry too (core/model).
 * Doc names `page/<id>` → `doc/<id>` are an IndexedDB copy, done by core/docs/legacy.ts.
 *
 * Also handles leftovers: v1 pages without a view, merged in after the doc is already v2
 * (a new device that migrated its empty workspace before the first sync, or an old
 * device creating pages). They are appended after existing siblings; existing views win.
 */

export const DEFAULT_SPACE_ID = 'default'
export const LOCAL_USER = 'local'

type YMap = Y.Map<unknown>

interface Legacy {
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

function readLegacy(id: string, m: YMap): Legacy {
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const deletedAt = m.get('deletedAt')
  return {
    id,
    title: str(m.get('title')),
    icon: str(m.get('icon')),
    parentId: typeof m.get('parentId') === 'string' ? (m.get('parentId') as string) : null,
    order: num(m.get('order'), 0),
    favorite: m.get('favorite') === true,
    createdAt: num(m.get('createdAt'), 0),
    updatedAt: num(m.get('updatedAt'), 0),
    deletedAt: typeof deletedAt === 'number' ? deletedAt : null,
  }
}

const byLegacyOrder = (a: Legacy, b: Legacy) =>
  a.order - b.order || a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Largest FracKey among `keys`, or null. */
function maxKey(keys: Iterable<unknown>): string | null {
  let max: string | null = null
  for (const k of keys) if (typeof k === 'string' && (max === null || k > max)) max = k
  return max
}

function ensureMap(parent: Y.Map<unknown>, key: string): YMap {
  const existing = parent.get(key)
  if (existing instanceof Y.Map) return existing as YMap
  const m = new Y.Map<unknown>()
  parent.set(key, m)
  return m
}

export const v2Views: Migration = {
  version: 2,
  name: 'views',
  leftover: v2Leftover,
  up(doc, ctx) {
    const pagesMap = doc.getMap<YMap>('pages')
    const views = doc.getMap<YMap>('views')
    const spaces = doc.getMap<YMap>('spaces')
    const users = doc.getMap<unknown>('users')

    const legacy: Legacy[] = []
    pagesMap.forEach((m, id) => {
      if (m instanceof Y.Map) legacy.push(readLegacy(id, m))
    })
    const known = new Set([...legacy.map((p) => p.id), ...views.keys()])
    const parentOf = (p: Legacy) =>
      p.parentId && p.parentId !== p.id && known.has(p.parentId) ? p.parentId : DEFAULT_SPACE_ID
    const todo = legacy.filter((p) => !views.has(p.id))

    if (spaces.size === 0 || (todo.some((p) => parentOf(p) === DEFAULT_SPACE_ID) && !spaces.has(DEFAULT_SPACE_ID))) {
      const s = new Y.Map<unknown>()
      s.set('name', ctx.defaultSpaceName)
      s.set('icon', { type: 'emoji', value: '🏠' })
      s.set('color', 'blue')
      s.set('order', generateKeyBetween(maxKey([...spaces.values()].map((m) => m.get('order'))), null))
      s.set('visibility', 'shared')
      s.set('ownerLogin', null)
      s.set('createdAt', ctx.now)
      spaces.set(DEFAULT_SPACE_ID, s)
    }

    // Group by new parent; append after existing children of that parent.
    const groups = new Map<string, Legacy[]>()
    for (const p of todo) {
      const parent = parentOf(p)
      groups.set(parent, [...(groups.get(parent) ?? []), p])
    }
    const parentKeys = [...groups.keys()].sort()
    for (const parent of parentKeys) {
      const group = groups.get(parent)!.sort(byLegacyOrder)
      const existing = [...views.values()].filter((v) => v.get('parentId') === parent).map((v) => v.get('order'))
      const keys = generateNKeysBetween(maxKey(existing), null, group.length)
      group.forEach((p, i) => {
        const v = new Y.Map<unknown>()
        v.set('kind', 'document')
        v.set('layout', 'document')
        v.set('databaseId', null)
        v.set('parentId', parent)
        v.set('order', keys[i])
        v.set('title', p.title)
        v.set('icon', p.icon ? { type: 'emoji', value: p.icon } : null)
        v.set('embedded', false)
        v.set('locked', false)
        v.set('createdAt', p.createdAt)
        v.set('createdBy', LOCAL_USER)
        v.set('updatedAt', p.updatedAt)
        v.set('updatedBy', LOCAL_USER)
        v.set('deletedAt', p.deletedAt)
        v.set('deletedBy', p.deletedAt === null ? null : LOCAL_USER)
        views.set(p.id, v)
      })
    }

    const favs = todo.filter((p) => p.favorite).sort(byLegacyOrder)
    if (favs.length) {
      const favorites = ensureMap(ensureMap(users, LOCAL_USER), 'favorites')
      const keys = generateNKeysBetween(maxKey(favorites.values()), null, favs.length)
      favs.forEach((p, i) => favorites.set(p.id, keys[i]))
    }
  },
}
