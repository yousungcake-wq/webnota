import * as Y from 'yjs'
import { destroyDoc, openDoc, pageDocName, retainDoc } from '@/core/docs/registry'
import {
  createView,
  databaseIdOf,
  deleteViewPermanently,
  descendantsOf,
  duplicateViewMeta,
  getView,
  listViews,
  restoreView,
  trashView,
  updateView,
  type ViewLayout,
} from '@/core/model/views'
import { ws } from '@/core/docs/workspace'
import { toggleExpanded } from '@/core/store/prefs'
import { currentRoute, navigate } from '@/core/store/router'
import { t } from '@/core/i18n'
import { toast } from '@/ui'
import { displayTitle } from './titles'
import { createDatabaseView } from '@/features/database'

/**
 * New view under `parentId`, or at the end of `spaceId` (default: the first space).
 * With a single available layout (today: documents, WS-11) this is what every "+" does.
 */
export function addPage(parentId: string | null = null, spaceId?: string, layout: ViewLayout = 'document') {
  if (layout !== 'document') return void addDatabase(parentId, spaceId, layout)
  const id = createView(ws(), { parentId, spaceId, layout, kind: 'document' })
  if (parentId) toggleExpanded(parentId, true)
  navigate({ name: 'page', id })
  return id
}

/** Database views (M4): the schema and row docs are created by the lazy database chunk. Failures reach the global error toast. */
async function addDatabase(
  parentId: string | null,
  spaceId: string | undefined,
  layout: Exclude<ViewLayout, 'document'>,
) {
  const id = await createDatabaseView({ parentId, spaceId, layout })
  if (parentId) toggleExpanded(parentId, true)
  navigate({ name: 'page', id })
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
  await deleteManyForever([id])
}

/** Restores every trashed view (WS-06). */
export function restoreAll() {
  const doc = ws()
  doc.transact(() => listViews(doc).forEach((v) => v.deletedAt && restoreView(doc, v.id)))
}

/** Permanently deletes `ids` (and their subtrees) with their content databases. */
export async function deleteManyForever(ids: string[]) {
  const doc = ws()
  const removed: string[] = []
  const dbIds: string[] = []
  doc.transact(() =>
    ids.forEach((id) => {
      for (const v of [id, ...descendantsOf(listViews(doc), id)]) {
        const db = databaseIdOf(doc, v)
        if (db) dbIds.push(db)
      }
      removed.push(...deleteViewPermanently(doc, id))
    }),
  )
  await Promise.all(removed.map((pid) => destroyDoc(pageDocName(pid))))
  if (dbIds.length) await (await import('@/core/docs/database')).destroyUnreferencedDatabases(doc, dbIds)
}

/** Startup: empties trash items older than 30 days when the device option is on (WS-06). */
export async function autoEmptyTrash(now = Date.now()) {
  const cutoff = now - 30 * 24 * 3600_000
  const old = listViews(ws()).filter((v) => v.deletedAt && v.deletedAt < cutoff)
  if (old.length) await deleteManyForever(old.map((v) => v.id))
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
