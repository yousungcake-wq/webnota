import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { DEFAULT_PAGE_STYLE, readCover, readPageStyle, setCover, setPageStyle } from './page'

describe('page style and cover (doc/<id> page map, spec/02 §3)', () => {
  it('defaults when nothing is stored', () => {
    const doc = new Y.Doc()
    expect(readPageStyle(doc)).toEqual(DEFAULT_PAGE_STYLE)
    expect(readCover(doc)).toBeNull()
  })
  it('stores fields separately so concurrent edits of different fields merge', () => {
    const a = new Y.Doc()
    const b = new Y.Doc()
    setPageStyle(a, { font: 'serif' })
    setPageStyle(b, { fullWidth: true })
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b))
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a))
    expect(readPageStyle(a)).toEqual({ ...DEFAULT_PAGE_STYLE, font: 'serif', fullWidth: true })
    expect(readPageStyle(b)).toEqual(readPageStyle(a))
  })
  it('ignores invalid stored values', () => {
    const doc = new Y.Doc()
    doc.getMap('page').set('font', 'comic')
    doc.getMap('page').set('fontSize', 42)
    expect(readPageStyle(doc)).toEqual(DEFAULT_PAGE_STYLE)
  })
  it('sets, repositions and removes the cover', () => {
    const doc = new Y.Doc()
    setCover(doc, { type: 'gradient', value: 'g2' })
    expect(readCover(doc)).toEqual({ type: 'gradient', value: 'g2', offsetY: 50 })
    setCover(doc, { ...readCover(doc)!, offsetY: 130 })
    expect(readCover(doc)!.offsetY).toBe(100)
    setCover(doc, null)
    expect(readCover(doc)).toBeNull()
  })
})
