import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { migrateDoc } from '../migrate'
import { getSchemaVersion } from '../version'
import { DEFAULT_SPACE_ID, LOCAL_USER, v2Views } from './002-views'

interface V1Page {
  title?: string
  icon?: string
  parentId?: string | null
  order?: number
  favorite?: boolean
  createdAt?: number
  updatedAt?: number
  deletedAt?: number | null
}

/** Writes a page exactly the way the PoC (v1) model did. */
function addV1(doc: Y.Doc, id: string, p: V1Page) {
  const m = new Y.Map<unknown>()
  m.set('title', p.title ?? '')
  m.set('icon', p.icon ?? '')
  m.set('parentId', p.parentId ?? null)
  m.set('order', p.order ?? 0)
  m.set('favorite', p.favorite ?? false)
  m.set('createdAt', p.createdAt ?? 1)
  m.set('updatedAt', p.updatedAt ?? 1)
  m.set('deletedAt', p.deletedAt ?? null)
  doc.getMap('pages').set(id, m)
}

const ctx = { now: 1000, defaultSpaceName: '일반' }
const run = (doc: Y.Doc) => migrateDoc(doc, { migrations: [v2Views], appVersion: 2, ctx })
const views = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>('views')
const view = (doc: Y.Doc, id: string) => views(doc).get(id)!.toJSON()
const favorites = (doc: Y.Doc) =>
  (doc.getMap<Y.Map<unknown>>('users').get(LOCAL_USER)?.get('favorites') as Y.Map<string> | undefined)?.toJSON() ?? {}
/** child ids of `parentId` in (order, id) order */
const childrenOf = (doc: Y.Doc, parentId: string) =>
  [...views(doc).entries()]
    .filter(([, m]) => m.get('parentId') === parentId)
    .sort(([a, x], [b, y]) => {
      const ka = x.get('order') as string
      const kb = y.get('order') as string
      return ka < kb ? -1 : ka > kb ? 1 : a < b ? -1 : 1
    })
    .map(([id]) => id)

describe('migration 002: pages → views', () => {
  it('converts every field of a page', () => {
    const doc = new Y.Doc()
    addV1(doc, 'p1', { title: '회의록', icon: '📄', createdAt: 10, updatedAt: 20 })
    expect(run(doc).status).toBe('migrated')
    expect(getSchemaVersion(doc)).toBe(2)
    expect(view(doc, 'p1')).toEqual({
      kind: 'document',
      layout: 'document',
      databaseId: null,
      parentId: DEFAULT_SPACE_ID,
      order: expect.any(String),
      title: '회의록',
      icon: { type: 'emoji', value: '📄' },
      embedded: false,
      locked: false,
      createdAt: 10,
      createdBy: LOCAL_USER,
      updatedAt: 20,
      updatedBy: LOCAL_USER,
      deletedAt: null,
      deletedBy: null,
    })
  })

  it('empty icon becomes null; trash state is kept', () => {
    const doc = new Y.Doc()
    addV1(doc, 'p1', { icon: '', deletedAt: 55 })
    run(doc)
    expect(view(doc, 'p1')).toMatchObject({ icon: null, deletedAt: 55, deletedBy: LOCAL_USER })
  })

  it('creates the default space and puts root pages in it', () => {
    const doc = new Y.Doc()
    addV1(doc, 'root', {})
    addV1(doc, 'child', { parentId: 'root' })
    addV1(doc, 'orphan', { parentId: 'gone' }) // parent permanently deleted
    run(doc)
    const space = doc.getMap<Y.Map<unknown>>('spaces').get(DEFAULT_SPACE_ID)!.toJSON()
    expect(space).toMatchObject({ name: '일반', visibility: 'shared', ownerLogin: null, createdAt: 1000 })
    expect(typeof space.order).toBe('string')
    expect(view(doc, 'root').parentId).toBe(DEFAULT_SPACE_ID)
    expect(view(doc, 'child').parentId).toBe('root')
    expect(view(doc, 'orphan').parentId).toBe(DEFAULT_SPACE_ID)
  })

  it('keeps sibling order (numeric order, then createdAt) as FracKeys', () => {
    const doc = new Y.Doc()
    addV1(doc, 'c', { order: 2 })
    addV1(doc, 'a', { order: -1.5 })
    addV1(doc, 'b2', { order: 0, createdAt: 9 })
    addV1(doc, 'b1', { order: 0, createdAt: 3 })
    addV1(doc, 'x', { parentId: 'c', order: 5 })
    addV1(doc, 'w', { parentId: 'c', order: 1 })
    run(doc)
    expect(childrenOf(doc, DEFAULT_SPACE_ID)).toEqual(['a', 'b1', 'b2', 'c'])
    expect(childrenOf(doc, 'c')).toEqual(['w', 'x'])
  })

  it('moves favorites to the local user, in sidebar order', () => {
    const doc = new Y.Doc()
    addV1(doc, 'p1', { favorite: true, order: 1 })
    addV1(doc, 'p2', { favorite: false, order: 2 })
    addV1(doc, 'p3', { favorite: true, order: 0 })
    run(doc)
    const favs = favorites(doc)
    expect(Object.keys(favs).sort()).toEqual(['p1', 'p3'])
    expect(favs.p3 < favs.p1).toBe(true)
    expect(views(doc).get('p1')!.has('favorite')).toBe(false)
  })

  it('keeps the legacy pages map: a v1 app deletes repo files of pages missing from it', () => {
    const doc = new Y.Doc()
    addV1(doc, 'p1', { title: 'T' })
    run(doc)
    expect(doc.getMap<Y.Map<unknown>>('pages').get('p1')!.get('title')).toBe('T')
    expect(v2Views.leftover!(doc)).toBe(false)
    expect(run(doc).status).toBe('current')
  })

  it('an empty workspace gets just the default space', () => {
    const doc = new Y.Doc()
    run(doc)
    expect(views(doc).size).toBe(0)
    expect([...doc.getMap('spaces').keys()]).toEqual([DEFAULT_SPACE_ID])
  })

  it('is deterministic: two devices migrating the same data concurrently merge to one result', () => {
    const base = new Y.Doc()
    addV1(base, 'r', { order: 0, favorite: true })
    addV1(base, 's', { order: 1 })
    addV1(base, 'k', { parentId: 'r' })
    const a = new Y.Doc()
    const b = new Y.Doc()
    Y.applyUpdate(a, Y.encodeStateAsUpdate(base))
    Y.applyUpdate(b, Y.encodeStateAsUpdate(base))
    run(a)
    run(b)
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    expect(a.getMap('views').toJSON()).toEqual(b.getMap('views').toJSON())
    expect(views(a).size).toBe(3)
    expect(a.getMap('spaces').size).toBe(1)
    expect(childrenOf(a, DEFAULT_SPACE_ID)).toEqual(['r', 's'])
    expect(Object.keys(favorites(a))).toEqual(['r'])
  })

  describe('leftover legacy pages (merged in after the doc is already v2)', () => {
    it('a new device: migrated empty doc, then old v1 data arrives from sync', () => {
      const local = new Y.Doc()
      run(local) // first boot: empty → v2
      const remote = new Y.Doc()
      addV1(remote, 'old', { title: 'from v1', favorite: true })
      addV1(remote, 'kid', { parentId: 'old' })
      Y.applyUpdate(local, Y.encodeStateAsUpdate(remote))
      expect(getSchemaVersion(local)).toBe(2)
      expect(v2Views.leftover!(local)).toBe(true)

      const r = run(local)
      expect(r.status).toBe('migrated')
      expect(r.applied).toEqual([2])
      expect(view(local, 'old')).toMatchObject({ title: 'from v1', parentId: DEFAULT_SPACE_ID })
      expect(view(local, 'kid').parentId).toBe('old')
      expect(Object.keys(favorites(local))).toEqual(['old'])
      expect(v2Views.leftover!(local)).toBe(false)
      expect(run(local).status).toBe('current')
    })

    it('appends leftovers after existing siblings and does not overwrite existing views', () => {
      const doc = new Y.Doc()
      addV1(doc, 'a', { title: 'A' })
      run(doc)
      views(doc).get('a')!.set('title', 'A edited in v2')
      addV1(doc, 'a', { title: 'stale v1 copy' }) // same id again
      addV1(doc, 'late', { order: -100 }) // v1 device created a page offline
      run(doc)
      expect(view(doc, 'a').title).toBe('A edited in v2')
      expect(childrenOf(doc, DEFAULT_SPACE_ID)).toEqual(['a', 'late'])
    })

    it('recreates the default space when a root leftover needs it', () => {
      const doc = new Y.Doc()
      run(doc)
      doc.getMap('spaces').delete(DEFAULT_SPACE_ID)
      addV1(doc, 'late', {})
      run(doc)
      expect(doc.getMap('spaces').has(DEFAULT_SPACE_ID)).toBe(true)
    })
  })
})
