import { ArrowUpDown, Plus, Settings2, Trash2 } from 'lucide-react'
import { t } from '@/core/i18n'
import { visibleSpaces } from '@/core/model/views'
import { setCurrentSpace } from '@/core/store/prefs'
import { useSpaces } from '@/core/store/views'
import { Menu, type MenuEntry } from '@/ui'
import { confirmDeleteSpace } from './deleteSpace'

/** Space list + "new space" / "space settings" (WS-02). Lazy. */
export default function SpaceMenu({
  anchor,
  currentId,
  onClose,
  onEdit,
  onReorder,
}: {
  anchor: HTMLElement
  currentId: string
  onClose: () => void
  /** Opens the space dialog: an id to edit, null to create. */
  onEdit: (id: string | null) => void
  onReorder: () => void
}) {
  const spaces = visibleSpaces(useSpaces())
  const items: MenuEntry[] = [
    ...spaces.map((s) => ({
      label: s.name || t('space.untitled'),
      checked: s.id === currentId,
      onSelect: () => setCurrentSpace(s.id),
    })),
    'separator',
    { label: t('space.new'), icon: Plus, onSelect: () => onEdit(null) },
    { label: t('space.settings'), icon: Settings2, onSelect: () => onEdit(currentId) },
    ...(spaces.length > 1
      ? [
          { label: t('space.reorder'), icon: ArrowUpDown, onSelect: onReorder },
          { label: t('space.delete'), icon: Trash2, danger: true, onSelect: () => void confirmDeleteSpace(currentId) },
        ]
      : []),
  ]
  return <Menu anchor={anchor} title={t('space.title')} items={items} onClose={onClose} />
}
