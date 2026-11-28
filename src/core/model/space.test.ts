import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { initSpaceDoc, readSpaceDocMeta, spaceViews, updateSpaceDocMeta } from './space'
import { createSpace, createView, listSpaces, setSpaceRepo, updateView } from './views'

describe('shared spaces (M9-00)', () => {
  it('a space links to its repository and back', () => {
    const ws = new Y.Doc()
    const id = createSpace(ws, { name: '팀', repo: 'me/webnota-space-team' })
    expect(listSpaces(ws).find((s) => s.id === id)?.repo).toBe('me/webnota-space-team')
    setSpaceRepo(ws, id, null)
    expect(listSpaces(ws).find((s) => s.id === id)?.repo).toBeNull()
    expect(listSpaces(ws).every((s) => s.repo === null)).toBe(true)
  })

  it('the space document holds meta and a view tree that the view functions use as is', () => {
    const doc = new Y.Doc()
    expect(readSpaceDocMeta(doc)).toBeNull()
    expect(spaceViews(doc)).toEqual([])
    initSpaceDoc(doc, { id: 'sp1', name: '팀', schemaVersion: 26 })
    const a = createView(doc, { spaceId: 'sp1', title: 'A' })
    const b = createView(doc, { parentId: a, title: 'B' })
    updateView(doc, b, { title: 'B2' })
    const views = spaceViews(doc)
    expect(views.map((v) => [v.title, v.spaceId, v.parentId]).sort()).toEqual([
      ['A', 'sp1', null],
      ['B2', 'sp1', a],
    ])
    updateSpaceDocMeta(doc, { name: '우리 팀' })
    expect(readSpaceDocMeta(doc)).toMatchObject({ id: 'sp1', name: '우리 팀', schemaVersion: 26 })
  })

  it('two members editing the space document merge', () => {
    const a = new Y.Doc()
    initSpaceDoc(a, { id: 'sp1', name: '팀', schemaVersion: 26 })
    const b = new Y.Doc()
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    createView(a, { spaceId: 'sp1', title: 'from A' })
    createView(b, { spaceId: 'sp1', title: 'from B' })
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    expect(
      spaceViews(a)
        .map((v) => v.title)
        .sort(),
    ).toEqual(['from A', 'from B'])
    expect(spaceViews(b)).toEqual(spaceViews(a))
  })
})
