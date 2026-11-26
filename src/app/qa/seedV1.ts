import { IndexeddbPersistence, storeState } from 'y-indexeddb'
import * as Y from 'yjs'

/**
 * QA (`webnota:debug=seed-v1`): writes a PoC (schema v1) workspace into IndexedDB under
 * the legacy names, exactly as v0.1.0 stored it, so the v2 migration and the
 * `page/`→`doc/` copy can be exercised end to end (e2e, real devices). Runs once.
 */
const DONE = 'webnota:qa-seed-v1'

async function write(name: string, fill: (doc: Y.Doc) => void) {
  const doc = new Y.Doc()
  const p = new IndexeddbPersistence(`webnota:${name}`, doc)
  await p.whenSynced
  fill(doc)
  await storeState(p, true)
  await p.destroy()
}

function page(
  doc: Y.Doc,
  id: string,
  title: string,
  icon: string,
  parentId: string | null,
  order: number,
  favorite: boolean,
) {
  const m = new Y.Map<unknown>()
  m.set('title', title)
  m.set('icon', icon)
  m.set('parentId', parentId)
  m.set('order', order)
  m.set('favorite', favorite)
  m.set('createdAt', 1700000000000 + order)
  m.set('updatedAt', 1700000000000 + order)
  m.set('deletedAt', null)
  doc.getMap('pages').set(id, m)
}

export async function seedV1() {
  if (localStorage.getItem(DONE)) return
  await write('workspace', (doc) => {
    page(doc, 'v1second', 'Second page', '', null, 1, false)
    page(doc, 'v1root', 'Old page', '📘', null, 0, true)
    page(doc, 'v1child', 'Child page', '', 'v1root', 0, false)
  })
  await write('page/v1root', (doc) => {
    const para = new Y.XmlElement('paragraph')
    para.insert(0, [new Y.XmlText('Body written in the PoC')])
    doc.getXmlFragment('default').insert(0, [para])
  })
  localStorage.setItem('webnota:seeded', '1')
  localStorage.setItem(DONE, '1')
}
