import * as Y from 'yjs'
import { destroyDoc, openDoc, pageDocName } from '../store/docs'
import {
  createPage,
  deletePagePermanently,
  descendantsOf,
  getPage,
  listPages,
  restorePage,
  trashPage,
  updatePage,
} from '../store/pages'
import { ws } from '../store/workspace'
import { navigate, toggleExpanded } from './hooks'

export function addPage(parentId: string | null = null) {
  const id = createPage(ws(), { parentId })
  if (parentId) toggleExpanded(parentId, true)
  navigate({ name: 'page', id })
  return id
}

export function toggleFavorite(id: string) {
  const p = getPage(ws(), id)
  if (p) updatePage(ws(), id, { favorite: !p.favorite })
}

export function moveToTrash(id: string, currentPageId?: string) {
  trashPage(ws(), id)
  if (currentPageId && (currentPageId === id || descendantsOf(listPages(ws()), id).includes(currentPageId))) {
    navigate({ name: 'home' }, { replace: true })
  }
}

export function restore(id: string) {
  restorePage(ws(), id)
}

export async function deleteForever(id: string) {
  const removed = deletePagePermanently(ws(), id)
  await Promise.all(removed.map((pid) => destroyDoc(pageDocName(pid))))
}

export async function duplicatePage(id: string) {
  const src = getPage(ws(), id)
  if (!src) return
  const copyId = createPage(ws(), {
    parentId: src.parentId,
    title: src.title ? `${src.title} (사본)` : '',
    icon: src.icon,
  })
  const [from, to] = await Promise.all([openDoc(pageDocName(id)), openDoc(pageDocName(copyId))])
  Y.applyUpdate(to, Y.encodeStateAsUpdate(from))
  navigate({ name: 'page', id: copyId })
}

export function displayTitle(title: string) {
  return title.trim() || '제목 없음'
}
