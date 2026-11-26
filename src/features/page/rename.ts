import { ws } from '@/core/docs/workspace'
import { t } from '@/core/i18n'
import { updateView, type ViewMeta } from '@/core/model/views'
import { createStore } from '@/core/store/createStore'
import { whenHistoryIdle } from '@/platform/history'
import { promptDialog } from '@/ui'

/** Inline rename requests: the tree row (desktop) or the page title field picks them up. */
export const renameStore = createStore<{ id: string; where: 'tree' | 'page' } | null>(null)

/** Waits until a menu that just ran an item has closed and popped its history entry (MB-14). */
export async function afterMenuClosed() {
  await new Promise((r) => setTimeout(r, 0))
  await whenHistoryIdle()
}

/** Renames on a phone with a dialog; on desktop the tree row or the title field edits inline. */
export async function renameView(view: ViewMeta, where: 'tree' | 'page', phone: boolean) {
  if (!phone) {
    renameStore.set({ id: view.id, where })
    return
  }
  await afterMenuClosed() // or the dialog's own history entry would be popped instead
  const title = await promptDialog({ title: t('page.rename'), label: t('page.titleLabel'), value: view.title })
  if (title !== null) updateView(ws(), view.id, { title: title.trim() })
}
