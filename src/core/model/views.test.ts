import { afterEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  adoptFavorites,
  createSpace,
  createView,
  DEFAULT_SPACE_ID,
  deleteSpace,
  deleteViewPermanently,
  duplicateViewMeta,
  getView,
  isAlive,
  listFavoriteIds,
  listSpaces,
  listViews,
  moveFavorite,
  moveSpace,
  moveView,
  restoreView,
  rootSpaceId,
  setCurrentUser,
  spacesOf,
  trashView,
  updateSpace,
  updateView,
  viewsOf,
  visibleSpaces,
} from './views'

function workspace() {
  const doc = new Y.Doc()
  const s = new Y.Map<unknown>()
  s.set('name', 'General')
  s.set('order', 'a0')
  spacesOf(doc).set(DEFAULT_SPACE_ID, s)
  return doc
}
const titles = (doc: Y.Doc, parentId: string | null = null, spaceId = DEFAULT_SPACE_ID) =>
  listViews(doc)
    .filter((p) => p.parentId === parentId && (parentId || p.spaceId === spaceId))
    .map((p) => p.title)
const three = (doc: Y.Doc) => ['A', 'B', 'C'].map((title) => createView(doc, { title })) as [string, string, string]

afterEach(() => setCurrentUser('local'))

describe('views (schema v2)', () => {
  it('creates a document view in the first space', () => {
    const doc = workspace()
    const id = createView(doc, { title: 'A', icon: { type: 'emoji', value: '📄' } })
    expect(viewsOf(doc).get(id)!.toJSON()).toMatchObject({
      kind: 'document',
      layout: 'document',
      parentId: DEFAULT_SPACE_ID,
      icon: { type: 'emoji', value: '📄' },
      createdBy: 'local',
      deletedAt: null,
    })
    expect(getView(doc, id)).toMatchObject({ title: 'A', parentId: null, spaceId: DEFAULT_SPACE_ID, favorite: false })
  })

  it('resolves the space through ancestors, cycle-safe', () => {
    const doc = workspace()
    const a = createView(doc, { title: 'A' })
    const b = createView(doc, { title: 'B', parentId: a })
    expect(getView(doc, b)).toMatchObject({ parentId: a, spaceId: DEFAULT_SPACE_ID })
    viewsOf(doc).get(a)!.set('parentId', b) // merge-made cycle
    expect(getView(doc, a)!.spaceId).toBe('')
    expect(isAlive(new Map(listViews(doc).map((v) => [v.id, v])), a)).toBe(false)
  })

  it('appends siblings, or inserts after a given one', () => {
    const doc = workspace()
    const [a] = three(doc)
    createView(doc, { title: 'A2', after: a })
    expect(titles(doc)).toEqual(['A', 'A2', 'B', 'C'])
  })

  it('keeps all icon kinds; only real changes bump updatedAt', () => {
    const doc = workspace()
    const id = createView(doc)
    updateView(doc, id, { icon: { type: 'icon', value: 'book', color: 'red' } })
    expect(getView(doc, id)!.icon).toEqual({ type: 'icon', value: 'book', color: 'red' })
    const m = viewsOf(doc).get(id)!
    m.set('updatedAt', 1)
    updateView(doc, id, { icon: { type: 'icon', value: 'book', color: 'red' }, favorite: true })
    expect(m.get('updatedAt')).toBe(1)
  })

  it('favorites are per user, ordered, and can be adopted from local after login', () => {
    const doc = workspace()
    const [a, b, c] = three(doc)
    for (const id of [a, b, c]) updateView(doc, id, { favorite: true })
    expect(listFavoriteIds(doc)).toEqual([a, b, c])
    moveFavorite(doc, c, [a, b, c], 0)
    expect(listFavoriteIds(doc)).toEqual([c, a, b])
    setCurrentUser('octocat')
    expect(getView(doc, a)!.favorite).toBe(false)
    updateView(doc, b, { favorite: true })
    adoptFavorites(doc, 'local')
    expect(listFavoriteIds(doc)).toEqual([b, c, a])
  })

  it('hides embedded views; lists databases', () => {
    const doc = workspace()
    createView(doc, { title: 'doc' })
    createView(doc, { title: 'db', kind: 'database', layout: 'grid' })
    const emb = new Y.Map<unknown>()
    emb.set('kind', 'document')
    emb.set('embedded', true)
    viewsOf(doc).set('e1', emb)
    expect(listViews(doc).map((v) => `${v.title}:${v.layout}`)).toEqual(['doc:document', 'db:grid'])
  })

  it('moves within siblings, under another view, and to another space', () => {
    const doc = workspace()
    const [a, b, c] = three(doc)
    moveView(doc, c, { parentId: null, index: 0 })
    expect(titles(doc)).toEqual(['C', 'A', 'B'])
    moveView(doc, a, { parentId: null, index: 2 })
    expect(titles(doc)).toEqual(['C', 'B', 'A'])
    expect(moveView(doc, b, { parentId: c, index: 0 })).toBe(true)
    expect(titles(doc, c)).toEqual(['B'])
    expect(moveView(doc, c, { parentId: b, index: 0 })).toBe(false) // into own descendant
    const s2 = createSpace(doc, { name: 'Two' })
    moveView(doc, c, { parentId: null, spaceId: s2, index: 0 })
    expect(getView(doc, b)!.spaceId).toBe(s2) // child follows
  })

  it('re-keys siblings when concurrent inserts produced equal keys', () => {
    const doc = workspace()
    const [a, b, c] = three(doc)
    viewsOf(doc).get(a)!.set('order', 'a0')
    viewsOf(doc).get(b)!.set('order', 'a0')
    const [first, second] = titles(doc).slice(0, 2)
    moveView(doc, c, { parentId: null, index: 1 })
    expect(titles(doc)).toEqual([first, 'C', second])
    expect(new Set(listViews(doc).map((p) => p.order)).size).toBe(3)
  })

  it('trash, restore (orphans go to the root space) and permanent delete', () => {
    const doc = workspace()
    const parent = createView(doc, { title: 'P' })
    const child = createView(doc, { title: 'C', parentId: parent })
    updateView(doc, child, { favorite: true })
    trashView(doc, child)
    expect(getView(doc, child)!.deletedBy).toBe('local')
    viewsOf(doc).delete(parent)
    restoreView(doc, child)
    expect(getView(doc, child)).toMatchObject({
      deletedAt: null,
      deletedBy: null,
      parentId: null,
      spaceId: DEFAULT_SPACE_ID,
    })
    doc.getMap('pages').set(child, new Y.Map()) // frozen v1 copy
    expect(deleteViewPermanently(doc, child)).toEqual([child])
    expect(viewsOf(doc).has(child)).toBe(false)
    expect(doc.getMap('pages').has(child)).toBe(false)
    expect(listFavoriteIds(doc)).toEqual([])
  })

  it('duplicates metadata right after the source', () => {
    const doc = workspace()
    const [a] = three(doc)
    updateView(doc, a, { icon: { type: 'emoji', value: '🚀' } })
    const copy = duplicateViewMeta(doc, a, 'A (copy)')!
    expect(titles(doc)).toEqual(['A', 'A (copy)', 'B', 'C'])
    expect(getView(doc, copy)!.icon).toEqual({ type: 'emoji', value: '🚀' })
  })
})

describe('spaces (WS-02)', () => {
  it('create, update, order and private visibility', () => {
    const doc = workspace()
    const s2 = createSpace(doc, { name: 'Two', icon: { type: 'emoji', value: '🎯' } })
    const s3 = createSpace(doc, { name: 'Mine', visibility: 'private' })
    expect(listSpaces(doc).map((s) => s.name)).toEqual(['General', 'Two', 'Mine'])
    moveSpace(doc, s3, 0)
    expect(listSpaces(doc).map((s) => s.name)).toEqual(['Mine', 'General', 'Two'])
    expect(rootSpaceId(doc)).toBe(s3)
    setCurrentUser('someone-else')
    expect(visibleSpaces(listSpaces(doc)).map((s) => s.name)).toEqual(['General', 'Two'])
    expect(rootSpaceId(doc)).toBe(DEFAULT_SPACE_ID)
    setCurrentUser('local')
    updateSpace(doc, s2, { name: 'Renamed', color: 'green' })
    expect(listSpaces(doc).find((s) => s.id === s2)).toMatchObject({ name: 'Renamed', color: 'green' })
  })

  it('deleting a space trashes its views; the last space cannot be deleted', () => {
    const doc = workspace()
    const s2 = createSpace(doc, { name: 'Two' })
    const v = createView(doc, { title: 'in two', spaceId: s2 })
    expect(deleteSpace(doc, s2)).toBe(true)
    expect(getView(doc, v)!.deletedAt).not.toBeNull()
    restoreView(doc, v)
    expect(getView(doc, v)!.spaceId).toBe(DEFAULT_SPACE_ID)
    expect(deleteSpace(doc, DEFAULT_SPACE_ID)).toBe(false)
  })
})
