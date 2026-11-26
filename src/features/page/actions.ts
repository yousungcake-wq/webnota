import * as Y from 'yjs'
import { destroyDoc, openDoc, pageDocName } from '@/core/docs/registry'
import {
  createPage,
  deletePagePermanently,
  descendantsOf,
  getPage,
  listPages,
  restorePage,
  trashPage,
  updatePage,
} from '@/core/model/pages'
import { ws } from '@/core/docs/workspace'
import { toggleExpanded } from '@/core/store/prefs'
import { navigate } from '@/core/store/router'
import { t } from '@/core/i18n'
import { toast } from '@/ui'
import { displayTitle } from './titles'

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
  const page = getPage(ws(), id)
  trashPage(ws(), id)
  toast(t('page.movedToTrash', { title: displayTitle(page?.title ?? '') }), {
    action: { label: t('common.undo'), onClick: () => restorePage(ws(), id) },
  })
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
    title: src.title ? t('page.copySuffix', { title: src.title }) : '',
    icon: src.icon,
  })
  const [from, to] = await Promise.all([openDoc(pageDocName(id)), openDoc(pageDocName(copyId))])
  Y.applyUpdate(to, Y.encodeStateAsUpdate(from))
  navigate({ name: 'page', id: copyId })
}
