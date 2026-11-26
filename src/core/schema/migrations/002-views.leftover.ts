import type * as Y from 'yjs'

/** v1 pages without a view (see 002-views.ts). Small and eager: checked after every remote merge. */
export function v2Leftover(doc: Y.Doc): boolean {
  if (!doc.share.has('pages')) return false
  const views = doc.getMap('views')
  for (const id of doc.getMap('pages').keys()) if (!views.has(id)) return true
  return false
}
