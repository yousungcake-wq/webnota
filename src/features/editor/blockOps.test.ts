import { EditorState } from '@tiptap/pm/state'
import { describe, expect, it } from 'vitest'
import {
  addColumn,
  deleteBlock,
  duplicateBlock,
  duplicateRange,
  ensureBlockId,
  findBlock,
  mergeLastColumn,
  setBlockAttr,
  setRangeAttr,
  supportsAttr,
} from './blockOps'
import { docSchema } from './schema'

const schema = docSchema()
const p = (text: string, attrs: Record<string, unknown> = {}) => ({
  type: 'paragraph',
  attrs,
  content: [{ type: 'text', text }],
})
const state = (content: unknown[]) => EditorState.create({ schema, doc: schema.nodeFromJSON({ type: 'doc', content }) })
const texts = (s: EditorState) => s.doc.content.content.map((n) => n.textContent)

describe('block ops', () => {
  it('duplicates a block without its block id', () => {
    const s = state([p('a', { blockId: 'x' }), p('b')])
    const next = s.apply(duplicateBlock(s, 0)!)
    expect(texts(next)).toEqual(['a', 'a', 'b'])
    expect(next.doc.child(1).attrs.blockId).toBeNull()
  })
  it('deletes a block', () => {
    const s = state([p('a'), p('b')])
    expect(texts(s.apply(deleteBlock(s, 0)!))).toEqual(['b'])
  })
  it('sets colors on a block, or on every item of a list', () => {
    const s = state([
      p('a'),
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [p('1')] },
          { type: 'listItem', content: [p('2')] },
        ],
      },
    ])
    expect(s.apply(setBlockAttr(s, 0, 'bgColor', 'red')!).doc.child(0).attrs.bgColor).toBe('red')
    const listPos = s.doc.child(0).nodeSize
    expect(supportsAttr(s.doc.child(1), 'textColor')).toBe(true)
    expect(supportsAttr(s.doc.child(1), 'textAlign')).toBe(false)
    const list = s.apply(setBlockAttr(s, listPos, 'textColor', 'blue')!).doc.child(1)
    list.forEach((item) => expect(item.attrs.textColor).toBe('blue'))
  })
  it('assigns a block id once and finds the block by it', () => {
    const s = state([p('a'), p('b')])
    const pos = s.doc.child(0).nodeSize
    const first = ensureBlockId(s, pos, () => 'id1')!
    const next = s.apply(first.tr!)
    expect(ensureBlockId(next, pos, () => 'id2')).toEqual({ id: 'id1', tr: null })
    expect(findBlock(next.doc, 'id1')).toBe(pos)
    expect(findBlock(next.doc, 'nope')).toBe(-1)
  })
  it('adds a column and merges the last one into its neighbour without losing content', () => {
    const cols = (n: number) => ({
      type: 'columns',
      content: Array.from({ length: n }, (_, i) => ({ type: 'column', content: [p(`c${i}`)] })),
    })
    const s = state([cols(3)])
    expect(s.apply(addColumn(s, 0)!).doc.child(0).childCount).toBe(4)
    const merged = s.apply(mergeLastColumn(s, 0)!).doc.child(0)
    expect(merged.childCount).toBe(2)
    expect(merged.child(1).textContent).toBe('c1c2')
    const two = state([cols(2)])
    expect(mergeLastColumn(two, 0)).toBeNull()
  })
})

describe('range ops', () => {
  it('duplicates several blocks after the range and colors them all', () => {
    const s = state([p('a'), p('b'), p('c')])
    const a = 0
    const b = s.doc.child(0).nodeSize
    const end = b + s.doc.child(1).nodeSize
    expect(texts(s.apply(duplicateRange(s, a, end)))).toEqual(['a', 'b', 'a', 'b', 'c'])
    const colored = s.apply(setRangeAttr(s, [a, b], 'bgColor', 'red')!)
    expect([0, 1, 2].map((i) => colored.doc.child(i).attrs.bgColor)).toEqual(['red', 'red', null])
  })
})
