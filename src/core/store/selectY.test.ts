import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { createView, getView, listViews, updateView } from '../model/views'
import { shallowEqual, shallowItemsEqual } from './equality'
import { selectY } from './selectY'

describe('selectY', () => {
  it('keeps the previous result when the selected part did not change', () => {
    const doc = new Y.Doc()
    const a = createView(doc, { title: 'A' })
    const b = createView(doc, { title: 'B' })
    const sel = selectY(doc, (d) => getView(d, a), shallowEqual)
    const first = sel.getSnapshot()
    expect(sel.getSnapshot()).toBe(first) // cached without changes

    updateView(doc, b, { title: 'B2' }) // unrelated edit
    expect(sel.getSnapshot()).toBe(first)

    updateView(doc, a, { title: 'A2' })
    const second = sel.getSnapshot()
    expect(second).not.toBe(first)
    expect(second?.title).toBe('A2')
  })

  it('does not re-run the selector until the doc changes', () => {
    const doc = new Y.Doc()
    createView(doc, { title: 'A' })
    const selector = vi.fn(listViews)
    const sel = selectY(doc, selector, shallowItemsEqual)
    sel.getSnapshot()
    sel.getSnapshot()
    expect(selector).toHaveBeenCalledTimes(1)
    createView(doc, { title: 'B' })
    expect(sel.getSnapshot()).toHaveLength(2)
    expect(selector).toHaveBeenCalledTimes(2)
  })

  it('notifies after a transaction with the new snapshot already readable, and unsubscribes', () => {
    const doc = new Y.Doc()
    const sel = selectY(doc, (d) => listViews(d).length)
    const seen: number[] = []
    const off = sel.subscribe(() => seen.push(sel.getSnapshot()))
    createView(doc)
    doc.transact(() => {
      createView(doc)
      createView(doc)
    })
    expect(seen).toEqual([1, 3])
    off()
    createView(doc)
    expect(seen).toEqual([1, 3])
  })

  it('sees changes made between the first read and subscribing', () => {
    const doc = new Y.Doc()
    const sel = selectY(doc, (d) => listViews(d).length)
    expect(sel.getSnapshot()).toBe(0) // render
    createView(doc) // change before the effect subscribes
    sel.subscribe(() => {})
    expect(sel.getSnapshot()).toBe(1) // useSyncExternalStore re-checks after subscribing
  })
})

describe('listViewsStable', () => {
  it('keeps unchanged view objects across updates', async () => {
    const { listViewsStable } = await import('./views')
    const doc = new Y.Doc()
    const a = createView(doc, { title: 'A' })
    createView(doc, { title: 'B' })
    const first = listViewsStable(doc)
    updateView(doc, a, { title: 'A2' })
    const second = listViewsStable(doc)
    expect(second[0]).not.toBe(first[0])
    expect(second[1]).toBe(first[1])
  })
})
