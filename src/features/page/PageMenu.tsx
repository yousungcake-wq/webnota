import {
  Copy,
  ExternalLink,
  FolderInput,
  Info,
  Link,
  Lock,
  LockOpen,
  Pencil,
  Search,
  Plus,
  SmilePlus,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react'
import { ws } from '@/core/docs/workspace'
import { t } from '@/core/i18n'
import { updateView, type ViewMeta } from '@/core/model/views'
import { href } from '@/core/store/router'
import { useLayout } from '@/platform/layout'
import { Menu, toast, type MenuEntry } from '@/ui'
import { addPage, duplicatePage, moveToTrash, toggleFavorite } from './actions'
import { openIconPicker, openMoveDialog, openViewInfo } from './overlays'
import { afterMenuClosed, renameView } from './rename'
import { displayTitle } from './titles'

export const pageUrl = (id: string) => `${location.origin}${location.pathname}${href({ name: 'page', id })}`

/** "More" menu of a view (WS-03), in the tree and the page header. */
export function PageMenu({
  page,
  anchor,
  where = 'tree',
  onClose,
}: {
  page: ViewMeta
  anchor: HTMLElement | null
  where?: 'tree' | 'page'
  onClose: () => void
}) {
  const phone = useLayout().layout === 'phone'
  const items: MenuEntry[] = [
    { label: t('page.rename'), icon: Pencil, shortcut: 'F2', onSelect: () => void renameView(page, where, phone) },
    { label: t('page.changeIcon'), icon: SmilePlus, onSelect: () => openIconPicker(page.id, anchor) },
    {
      label: page.favorite ? t('page.favoriteRemove') : t('page.favoriteAdd'),
      icon: page.favorite ? StarOff : Star,
      onSelect: () => toggleFavorite(page.id),
    },
    { label: t('page.addChild'), icon: Plus, onSelect: () => addPage(page.id) },
    { label: t('page.duplicate'), icon: Copy, onSelect: () => void duplicatePage(page.id) },
    { label: t('page.move'), icon: FolderInput, onSelect: () => openMoveDialog(page.id) },
    'separator',
    {
      label: t('page.copyLink'),
      icon: Link,
      onSelect: () =>
        void navigator.clipboard?.writeText(pageUrl(page.id)).then(
          () => toast(t('page.linkCopied')),
          () => toast(t('page.linkCopyFailed'), { tone: 'error' }),
        ),
    },
    ...(phone
      ? []
      : [{ label: t('page.openNewTab'), icon: ExternalLink, onSelect: () => window.open(pageUrl(page.id), '_blank') }]),
    {
      label: page.locked ? t('page.unlock') : t('page.lock'),
      icon: page.locked ? LockOpen : Lock,
      onSelect: () => updateView(ws(), page.id, { locked: !page.locked }),
    },
    { label: t('page.info'), icon: Info, onSelect: () => openViewInfo(page.id) },
    ...(where === 'page'
      ? [
          {
            label: t('find.inPage'),
            icon: Search,
            shortcut: '⌘F',
            // the editor opens its find bar (ED-F07); wait for the phone sheet to close first
            onSelect: () => void afterMenuClosed().then(() => window.dispatchEvent(new Event('webnota:find'))),
          },
        ]
      : []),
    'separator',
    { label: t('page.moveToTrash'), icon: Trash2, danger: true, onSelect: () => moveToTrash(page.id) },
  ]
  return <Menu anchor={anchor} title={displayTitle(page.title)} onClose={onClose} items={items} />
}
