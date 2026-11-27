import { describe, expect, it } from 'vitest'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { docSchema } from './schema'
import { blocksInRanges, changedRanges } from './code/changed'

const schema = docSchema()
const doc = schema.nodeFromJSON({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'intro' }] },
    { type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text: 'const a = 1' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'middle' }] },
    { type: 'codeBlock', attrs: { language: 'py' }, content: [{ type: 'text', text: 'x = 2' }] },
  ],
})
const state = EditorState.create({ schema, doc })
const codeStarts: number[] = []
doc.forEach((n, off) => n.type.name === 'codeBlock' && codeStarts.push(off))

describe('changed ranges (M3-00 decoration check)', () => {
  it('typing in a paragraph touches no code block', () => {
    const tr = state.tr.insertText('!', 3)
    expect(blocksInRanges(tr.doc, changedRanges(tr), 'codeBlock')).toEqual([])
  })
  it('typing in a code block touches only that block', () => {
    const tr = state.tr.insertText('!', codeStarts[1]! + 2)
    const hit = blocksInRanges(tr.doc, changedRanges(tr), 'codeBlock')
    expect(hit.map((h) => h.node.attrs.language)).toEqual(['py'])
  })
  it('a language change (node markup) is a touch', () => {
    const tr = state.tr.setNodeMarkup(codeStarts[0]!, undefined, { language: 'ts' })
    expect(blocksInRanges(tr.doc, changedRanges(tr), 'codeBlock').map((h) => h.node.attrs.language)).toEqual(['ts'])
  })
  it('maps earlier step ranges through later steps', () => {
    const tr = state.tr.insertText('x', codeStarts[0]! + 1).insertText('long prefix ', 1)
    const hit = blocksInRanges(tr.doc, changedRanges(tr), 'codeBlock')
    expect(hit).toHaveLength(1)
    expect(hit[0]!.node.textContent).toBe('xconst a = 1')
  })
  it('selection-only transactions have no ranges', () => {
    const tr = state.tr.setSelection(TextSelection.create(doc, 2))
    expect(changedRanges(tr)).toEqual([])
  })
})
