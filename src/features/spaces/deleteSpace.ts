import { ws } from '@/core/docs/workspace'
import { t } from '@/core/i18n'
import { deleteSpace, listSpaces } from '@/core/model/views'
import { confirmDialog } from '@/ui'

/** Asks, then deletes a space; its pages go to the trash (WS-02). False when cancelled or the last space. */
export async function confirmDeleteSpace(id: string): Promise<boolean> {
  const space = listSpaces(ws()).find((s) => s.id === id)
  if (!space || listSpaces(ws()).length <= 1) return false
  const ok = await confirmDialog({
    title: t('space.delete'),
    message: t('space.deleteConfirm', { name: space.name || t('space.untitled') }),
    confirmLabel: t('space.delete'),
    danger: true,
  })
  return ok && deleteSpace(ws(), id)
}
