import * as Y from 'yjs'
import { destroyDoc, openDoc, pageDocName, retainDoc } from '@/core/docs/registry'
import {
  createView,
  deleteViewPermanently,
  descendantsOf,
  duplicateViewMeta,
  getView,
  listViews,
  restoreView,
  trashView,
  updateView,
} from '@/core/model/views'
import { ws } from '@/core/docs/workspace'
import { toggleExpanded } from '@/core/store/prefs'
import { currentRoute, navigate } from '@/core/store/router'
import { t } from '@/core/i18n'
import { toast } from '@/ui'
import { displayTitle } from './titles'

/** New document view under `parentId`, or at the end of `spaceId` (default: the first space). */
export function addPage(parentId: string | null = null, spaceId?: string) {
  const id = createView(ws(), { parentId, spaceId })
  if (parentId) toggleExpanded(parentId, true)
  navigate({ name: 'page', id })
  return id
}

export function toggleFavorite(id: string) {
  const p = getView(ws(), id)
  if (p) updateView(ws(), id, { favorite: !p.favorite })
}

export function moveToTrash(id: string) {
  const route = currentRoute()
  const currentPageId = route.name === 'page' ? route.id : undefined
  const page = getView(ws(), id)
  trashView(ws(), id)
  toast(t('page.movedToTrash', { title: displayTitle(page?.title ?? '') }), {
    action: { label: t('common.undo'), onClick: () => restoreView(ws(), id) },
  })
  if (currentPageId && (currentPageId === id || descendantsOf(listViews(ws()), id).includes(currentPageId))) {
    navigate({ name: 'home' }, { replace: true })
  }
}

export function restore(id: string) {
  restoreView(ws(), id)
}

export async function deleteForever(id: string) {
  const removed = deleteViewPermanently(ws(), id)
  await Promise.all(removed.map((pid) => destroyDoc(pageDocName(pid))))
}

export async function duplicatePage(id: string) {
  const src = getView(ws(), id)
  if (!src) return
  const copyId = duplicateViewMeta(ws(), id, src.title ? t('page.copySuffix', { title: src.title }) : '')
  if (!copyId) return
  const releases = [retainDoc(pageDocName(id)), retainDoc(pageDocName(copyId))]
  try {
    const [from, to] = await Promise.all([openDoc(pageDocName(id)), openDoc(pageDocName(copyId))])
    Y.applyUpdate(to, Y.encodeStateAsUpdate(from))
  } finally {
    releases.forEach((r) => r())
  }
  navigate({ name: 'page', id: copyId })
}
