import { Copy, Plus, Star, StarOff, Trash2 } from 'lucide-react'
import { displayTitle, type PageMeta } from '@/core/model/pages'
import { Menu } from '@/ui/Menu'
import { addPage, duplicatePage, moveToTrash, toggleFavorite } from './actions'

export function PageMenu({
  page,
  anchor,
  currentId,
  onClose,
}: {
  page: PageMeta
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
        { label: '하위 페이지 추가', icon: Plus, onSelect: () => addPage(page.id) },
        {
          label: page.favorite ? '즐겨찾기에서 제거' : '즐겨찾기에 추가',
          icon: page.favorite ? StarOff : Star,
          onSelect: () => toggleFavorite(page.id),
        },
        { label: '복제', icon: Copy, onSelect: () => void duplicatePage(page.id) },
        { label: '휴지통으로 이동', icon: Trash2, danger: true, onSelect: () => moveToTrash(page.id, currentId) },
      ]}
    />
  )
}
