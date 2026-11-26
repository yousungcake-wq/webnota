import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { docSchema } from './extensions'
import { findUnknownContent } from './unknown'

function fragmentWith(build: (f: Y.XmlFragment) => void) {
  const doc = new Y.Doc()
  const f = doc.getXmlFragment('default')
  build(f)
  return f
}

describe('findUnknownContent (ED-B23)', () => {
  const schema = docSchema()

  it('finds nothing in a document made of known blocks and marks', () => {
    const f = fragmentWith((f) => {
      const p = new Y.XmlElement('paragraph')
      const text = new Y.XmlText()
      text.insert(0, 'bold', { bold: {} })
      p.insert(0, [text])
      const list = new Y.XmlElement('bulletList')
      const item = new Y.XmlElement('listItem')
      item.insert(0, [new Y.XmlElement('paragraph')])
      list.insert(0, [item])
      f.insert(0, [p, list])
    })
    expect(findUnknownContent(f, schema)).toEqual({ nodes: [], marks: [] })
  })

  it('finds unknown node types at any depth and unknown marks, once each', () => {
    const f = fragmentWith((f) => {
      const future = new Y.XmlElement('futureBlock')
      future.setAttribute('foo', 'bar')
      const list = new Y.XmlElement('bulletList')
      const item = new Y.XmlElement('listItem')
      const p = new Y.XmlElement('paragraph')
      const text = new Y.XmlText()
      text.insert(0, 'x', { futureMark: { a: 1 } })
      p.insert(0, [text, new Y.XmlElement('futureInline')])
      item.insert(0, [p])
      list.insert(0, [item])
      f.insert(0, [future, list, new Y.XmlElement('futureBlock')])
    })
    expect(findUnknownContent(f, schema)).toEqual({ nodes: ['futureBlock', 'futureInline'], marks: ['futureMark'] })
  })
})
