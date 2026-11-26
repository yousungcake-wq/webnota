import * as Y from 'yjs'
import { openDoc, pageDocName } from '@/core/docs/registry'
import { createPage } from '@/core/model/pages'

/**
 * QA (`webnota:debug=seed-unknown`): once, adds a page whose body holds a block type and
 * a mark this build does not know, as a newer app version would write (ED-B23).
 */
const DONE = 'webnota:qa-seed-unknown'

export async function seedUnknown(ws: Y.Doc): Promise<void> {
  if (localStorage.getItem(DONE)) return
  const id = createPage(ws, { title: 'Unknown content test' })
  const doc = await openDoc(pageDocName(id))
  const para = (text: string, attrs?: Record<string, unknown>) => {
    const p = new Y.XmlElement('paragraph')
    const tx = new Y.XmlText()
    tx.insert(0, text, attrs)
    p.insert(0, [tx])
    return p
  }
  const future = new Y.XmlElement('futureBlock')
  future.setAttribute('payload', 'keep-me')
  future.insert(0, [para('inside the future block')])
  doc
    .getXmlFragment('default')
    .insert(0, [para('known before'), future, para('marked text', { futureMark: { level: 2 } }), para('known after')])
  localStorage.setItem(DONE, '1')
}
