import type * as Y from 'yjs'
import { createView } from '@/core/model/views'

/** QA (`webnota:debug=seed-many`): once, adds 300 pages (with a nested group) to exercise the virtual tree. */
const DONE = 'webnota:qa-seed-many'

export function seedMany(ws: Y.Doc) {
  if (localStorage.getItem(DONE)) return
  ws.transact(() => {
    const group = createView(ws, { title: 'Group 000' })
    for (let i = 1; i <= 20; i++) createView(ws, { title: `Child ${String(i).padStart(3, '0')}`, parentId: group })
    for (let i = 1; i <= 280; i++) createView(ws, { title: `Page ${String(i).padStart(3, '0')}` })
  })
  localStorage.setItem(DONE, '1')
}
