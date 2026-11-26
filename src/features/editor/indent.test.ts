import { EditorState, TextSelection } from '@tiptap/pm/state'
import { describe, expect, it } from 'vitest'
import { indentBlock, outdentBlock } from './nodes/indent'
import { docSchema } from './schema'

const schema = docSchema()
const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
/** State with the caret inside the block whose text is `at`. */
function state(content: unknown[], at: string) {
  const doc = schema.nodeFromJSON({ type: 'doc', content })
  let pos = -1
  doc.descendants((n, p2) => {
    if (pos < 0 && n.isTextblock && n.textContent === at) pos = p2 + 1
  })
  return EditorState.create({ schema, doc, selection: TextSelection.create(doc, pos) })
}
const toggle = (summary: string, ...body: unknown[]) => ({
  type: 'toggle',
  attrs: { toggleId: 't1' },
  content: [
    { type: 'toggleSummary', content: [{ type: 'text', text: summary }] },
    { type: 'toggleContent', content: body.length ? body : [{ type: 'paragraph' }] },
  ],
})

describe('indent / outdent blocks', () => {
  it('Tab after a toggle moves the block into it; Shift+Tab moves it back out', () => {
    const s = state([toggle('T', p('in')), p('next')], 'next')
    const indented = s.apply(indentBlock(s)!)
    expect(indented.doc.childCount).toBe(1)
    expect(indented.doc.child(0).child(1).textContent).toBe('innext')
    expect(indented.selection.$from.parent.textContent).toBe('next')
    const out = indented.apply(outdentBlock(indented)!)
    expect(out.doc.childCount).toBe(2)
    expect(out.doc.child(1).textContent).toBe('next')
    expect(out.doc.child(0).child(1).textContent).toBe('in')
  })
  it('Shift+Tab on the only block of a toggle leaves an empty paragraph inside', () => {
    const s = state([toggle('T', p('only'))], 'only')
    const out = s.apply(outdentBlock(s)!)
    expect(out.doc.child(0).child(1).childCount).toBe(1)
    expect(out.doc.child(0).child(1).textContent).toBe('')
    expect(out.doc.child(1).textContent).toBe('only')
  })
  it('Tab after a list makes the block a child of the last item; Shift+Tab lifts it out', () => {
    const list = {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p('a')] },
        { type: 'listItem', content: [p('b')] },
      ],
    }
    const s = state([list, p('note')], 'note')
    const indented = s.apply(indentBlock(s)!)
    const last = indented.doc.child(0).lastChild!
    expect(last.childCount).toBe(2)
    expect(last.child(1).textContent).toBe('note')
    const out = indented.apply(outdentBlock(indented)!)
    expect(out.doc.child(0).lastChild!.childCount).toBe(1)
    expect(out.doc.lastChild!.textContent).toBe('note')
  })
  it('does nothing for a first block', () => {
    const s = state([p('first')], 'first')
    expect(indentBlock(s)).toBeNull()
    expect(outdentBlock(s)).toBeNull()
  })
})
