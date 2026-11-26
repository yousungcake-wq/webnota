import { Copy, Plus, Star, StarOff, Trash2 } from 'lucide-react'
import { type ViewMeta } from '@/core/model/views'
import { displayTitle } from './titles'
import { Menu } from '@/ui'
import { addPage, duplicatePage, moveToTrash, toggleFavorite } from './actions'
import { t } from '@/core/i18n'

export function PageMenu({
  page,
  anchor,
  currentId,
  onClose,
}: {
  page: ViewMeta
  anchor: HTMLElement | null
  currentId?: string
  onClose: () => void
}) {
  return (
    <Menu
      anchor={anchor}
      title={displayTitle(page.title)}
      onClose={onClose}
      items={[
        { label: t('page.addChild'), icon: Plus, onSelect: () => addPage(page.id) },
        {
          label: page.favorite ? t('page.favoriteRemove') : t('page.favoriteAdd'),
          icon: page.favorite ? StarOff : Star,
          onSelect: () => toggleFavorite(page.id),
        },
        { label: t('page.duplicate'), icon: Copy, onSelect: () => void duplicatePage(page.id) },
        { label: t('page.moveToTrash'), icon: Trash2, danger: true, onSelect: () => moveToTrash(page.id, currentId) },
      ]}
    />
  )
}
