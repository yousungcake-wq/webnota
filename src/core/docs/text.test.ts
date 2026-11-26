import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { docPlainText } from './text'

describe('docPlainText', () => {
  it('joins block texts with newlines, nested blocks included', () => {
    const doc = new Y.Doc()
    const p = (s: string) => {
      const el = new Y.XmlElement('paragraph')
      el.insert(0, [new Y.XmlText(s)])
      return el
    }
    const list = new Y.XmlElement('bulletList')
    const item = new Y.XmlElement('listItem')
    item.insert(0, [p('항목 하나')])
    list.insert(0, [item])
    doc.getXmlFragment('default').insert(0, [p('첫 줄'), list, p('끝')])
    expect(docPlainText(doc)).toBe('첫 줄\n항목 하나\n끝')
  })
})
