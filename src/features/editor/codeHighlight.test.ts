import { describe, expect, it } from 'vitest'
import { EditorState } from '@tiptap/pm/state'
import type { DecorationSet } from '@tiptap/pm/view'
import { docSchema } from './schema'
import { highlightInternals as h } from './code/codeBlock'

const schema = docSchema()
const doc = schema.nodeFromJSON({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'intro' }] },
    { type: 'codeBlock', attrs: { language: 'javascript' }, content: [{ type: 'text', text: 'const a = 1' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'middle' }] },
    { type: 'codeBlock', attrs: { language: 'javascript' }, content: [{ type: 'text', text: 'let b = 2' }] },
  ],
})
const flat = (set: DecorationSet, size: number) =>
  set
    .find(0, size)
    .map((d) => `${d.from}-${d.to}:${(d as unknown as { type: { attrs: { class: string } } }).type.attrs.class}`)

describe('code highlight is incremental (M3-00)', () => {
  it('matches a full recompute after edits inside and outside code blocks', async () => {
    const m = await h.load()
    await m.ensureLanguage('javascript')
    let state = EditorState.create({ schema, doc })
    let set = h.decorations(state.doc)
    const edits = [
      (s: EditorState) => s.tr.insertText('var ', 3), // paragraph: mapped only
      (s: EditorState) => s.tr.insertText('return ', s.doc.child(0).nodeSize + 1), // first code block
      (s: EditorState) => s.tr.delete(s.doc.content.size - 3, s.doc.content.size - 1), // second code block
    ]
    for (const edit of edits) {
      const tr = edit(state)
      set = h.nextDecorations(tr, set)
      state = state.apply(tr)
      expect(flat(set, state.doc.content.size)).toEqual(flat(h.decorations(state.doc), state.doc.content.size))
    }
    expect(set.find().length).toBeGreaterThan(2)
  })
})
