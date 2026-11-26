import { afterEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  createPage,
  DEFAULT_SPACE_ID,
  deletePagePermanently,
  getPage,
  listPages,
  movePage,
  restorePage,
  setCurrentUser,
  spacesOf,
  trashPage,
  updatePage,
  viewsOf,
} from './pages'

function workspace() {
  const doc = new Y.Doc()
  const s = new Y.Map<unknown>()
  s.set('order', 'a0')
  spacesOf(doc).set(DEFAULT_SPACE_ID, s)
  return doc
}
const titles = (doc: Y.Doc, parentId: string | null = null) =>
  listPages(doc)
    .filter((p) => p.parentId === parentId)
    .map((p) => p.title)

afterEach(() => setCurrentUser('local'))

describe('page model on views (schema v2)', () => {
  it('stores a document view under the first space; the UI sees parentId null', () => {
    const doc = workspace()
    const id = createPage(doc, { title: 'A', icon: '📄' })
    const raw = viewsOf(doc).get(id)!.toJSON()
    expect(raw).toMatchObject({
      kind: 'document',
      layout: 'document',
      parentId: DEFAULT_SPACE_ID,
      icon: { type: 'emoji', value: '📄' },
      createdBy: 'local',
      deletedAt: null,
    })
    expect(getPage(doc, id)).toMatchObject({ title: 'A', icon: '📄', parentId: null, favorite: false })
  })

  it('appends siblings with increasing FracKeys', () => {
    const doc = workspace()
    for (const t of ['1', '2', '3']) createPage(doc, { title: t })
    const keys = listPages(doc).map((p) => p.order)
    expect(keys).toEqual([...keys].sort())
    expect(titles(doc)).toEqual(['1', '2', '3'])
  })

  it('icon edits write IconValue; clearing gives null', () => {
    const doc = workspace()
    const id = createPage(doc)
    updatePage(doc, id, { icon: '🚀' })
    expect(viewsOf(doc).get(id)!.get('icon')).toEqual({ type: 'emoji', value: '🚀' })
    updatePage(doc, id, { icon: '' })
    expect(viewsOf(doc).get(id)!.get('icon')).toBeNull()
  })

  it('keeps non-emoji icons it cannot show', () => {
    const doc = workspace()
    const id = createPage(doc)
    viewsOf(doc).get(id)!.set('icon', { type: 'icon', value: 'book' })
    expect(getPage(doc, id)!.icon).toBe('')
    updatePage(doc, id, { title: 'x', icon: '' })
    expect(viewsOf(doc).get(id)!.get('icon')).toEqual({ type: 'icon', value: 'book' })
  })

  it('favorites are per user', () => {
    const doc = workspace()
    const id = createPage(doc)
    updatePage(doc, id, { favorite: true })
    expect(getPage(doc, id)!.favorite).toBe(true)
    expect(doc.getMap<Y.Map<Y.Map<string>>>('users').get('local')!.get('favorites')!.has(id)).toBe(true)
    setCurrentUser('octocat')
    expect(getPage(doc, id)!.favorite).toBe(false)
    setCurrentUser('local')
    updatePage(doc, id, { favorite: false })
    expect(getPage(doc, id)!.favorite).toBe(false)
  })

  it('hides database and embedded views', () => {
    const doc = workspace()
    createPage(doc, { title: 'doc' })
    const db = new Y.Map<unknown>()
    db.set('kind', 'database')
    viewsOf(doc).set('db1', db)
    const emb = new Y.Map<unknown>()
    emb.set('kind', 'document')
    emb.set('embedded', true)
    viewsOf(doc).set('e1', emb)
    expect(listPages(doc).map((p) => p.title)).toEqual(['doc'])
  })

  it('moves between siblings and under another page', () => {
    const doc = workspace()
    const [a, b, c] = ['A', 'B', 'C'].map((title) => createPage(doc, { title })) as [string, string, string]
    movePage(doc, c, null, 0)
    expect(titles(doc)).toEqual(['C', 'A', 'B'])
    movePage(doc, a, null, 2)
    expect(titles(doc)).toEqual(['C', 'B', 'A'])
    movePage(doc, b, c, 0)
    expect(titles(doc)).toEqual(['C', 'A'])
    expect(titles(doc, c)).toEqual(['B'])
    expect(viewsOf(doc).get(b)!.get('parentId')).toBe(c)
    movePage(doc, c, b, 0) // into own descendant: refused
    expect(getPage(doc, c)!.parentId).toBeNull()
    void a
  })

  it('re-keys siblings when concurrent inserts produced equal keys', () => {
    const doc = workspace()
    const [a, b, c] = ['A', 'B', 'C'].map((title) => createPage(doc, { title })) as [string, string, string]
    viewsOf(doc).get(a)!.set('order', 'a0')
    viewsOf(doc).get(b)!.set('order', 'a0')
    const [first, second] = titles(doc).slice(0, 2) // equal keys: tie broken by id
    movePage(doc, c, null, 1) // between two equal keys
    expect(titles(doc)).toEqual([first, 'C', second])
    const keys = listPages(doc).map((p) => p.order)
    expect(new Set(keys).size).toBe(3)
  })

  it('trash, restore (orphans go to the root) and permanent delete with favorites', () => {
    const doc = workspace()
    const parent = createPage(doc, { title: 'P' })
    const child = createPage(doc, { title: 'C', parentId: parent })
    updatePage(doc, child, { favorite: true })
    trashPage(doc, child)
    expect(viewsOf(doc).get(child)!.get('deletedBy')).toBe('local')
    viewsOf(doc).delete(parent)
    restorePage(doc, child)
    expect(getPage(doc, child)).toMatchObject({ deletedAt: null, parentId: null })
    expect(viewsOf(doc).get(child)!.get('deletedBy')).toBeNull()

    const legacy = new Y.Map<unknown>()
    doc.getMap('pages').set(child, legacy) // frozen v1 copy
    expect(deletePagePermanently(doc, child)).toEqual([child])
    expect(doc.getMap('pages').has(child)).toBe(false)
    expect(viewsOf(doc).has(child)).toBe(false)
    expect(doc.getMap<Y.Map<Y.Map<string>>>('users').get('local')!.get('favorites')!.size).toBe(0)
  })
})
