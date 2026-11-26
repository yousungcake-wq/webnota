import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { createPage, getPage, listPages, updatePage } from '../model/pages'
import { shallowEqual, shallowItemsEqual } from './equality'
import { selectY } from './selectY'

describe('selectY', () => {
  it('keeps the previous result when the selected part did not change', () => {
    const doc = new Y.Doc()
    const a = createPage(doc, { title: 'A' })
    const b = createPage(doc, { title: 'B' })
    const sel = selectY(doc, (d) => getPage(d, a), shallowEqual)
    const first = sel.getSnapshot()
    expect(sel.getSnapshot()).toBe(first) // cached without changes

    updatePage(doc, b, { title: 'B2' }) // unrelated edit
    expect(sel.getSnapshot()).toBe(first)

    updatePage(doc, a, { title: 'A2' })
    const second = sel.getSnapshot()
    expect(second).not.toBe(first)
    expect(second?.title).toBe('A2')
  })

  it('does not re-run the selector until the doc changes', () => {
    const doc = new Y.Doc()
    createPage(doc, { title: 'A' })
    const selector = vi.fn(listPages)
    const sel = selectY(doc, selector, shallowItemsEqual)
    sel.getSnapshot()
    sel.getSnapshot()
    expect(selector).toHaveBeenCalledTimes(1)
    createPage(doc, { title: 'B' })
    expect(sel.getSnapshot()).toHaveLength(2)
    expect(selector).toHaveBeenCalledTimes(2)
  })

  it('notifies after a transaction with the new snapshot already readable, and unsubscribes', () => {
    const doc = new Y.Doc()
    const sel = selectY(doc, (d) => listPages(d).length)
    const seen: number[] = []
    const off = sel.subscribe(() => seen.push(sel.getSnapshot()))
    createPage(doc)
    doc.transact(() => {
      createPage(doc)
      createPage(doc)
    })
    expect(seen).toEqual([1, 3])
    off()
    createPage(doc)
    expect(seen).toEqual([1, 3])
  })

  it('sees changes made between the first read and subscribing', () => {
    const doc = new Y.Doc()
    const sel = selectY(doc, (d) => listPages(d).length)
    expect(sel.getSnapshot()).toBe(0) // render
    createPage(doc) // change before the effect subscribes
    sel.subscribe(() => {})
    expect(sel.getSnapshot()).toBe(1) // useSyncExternalStore re-checks after subscribing
  })
})
