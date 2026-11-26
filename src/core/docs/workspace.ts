import type * as Y from 'yjs'
import { createPage, listPages, pagesOf, type PageMeta } from '../model/pages'
import { openDoc, WORKSPACE } from './registry'

let wsDoc: Y.Doc | null = null
let snapshot: PageMeta[] = []
const listeners = new Set<() => void>()

export async function initWorkspace(): Promise<Y.Doc> {
  if (wsDoc) return wsDoc
  const doc = await openDoc(WORKSPACE)
  wsDoc = doc
  snapshot = listPages(doc)
  pagesOf(doc).observeDeep(() => {
    snapshot = listPages(doc)
    listeners.forEach((l) => l())
  })
  return doc
}

export function ws(): Y.Doc {
  if (!wsDoc) throw new Error('workspace not initialised')
  return wsDoc
}

/** External-store contract for `core/store` hooks. */
export function subscribePages(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export const getPagesSnapshot = (): PageMeta[] => snapshot

/** Seeds a welcome page the very first time the app runs on this device. */
export function seedIfEmpty(): string | null {
  const doc = ws()
  if (pagesOf(doc).size > 0) return null
  if (localStorage.getItem('webnota:seeded')) return null
  localStorage.setItem('webnota:seeded', '1')
  return createPage(doc, { title: 'WebNota 시작하기', icon: '👋' })
}
