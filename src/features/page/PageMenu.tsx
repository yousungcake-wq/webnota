import {
  Copy,
  Download,
  ExternalLink,
  FolderInput,
  Info,
  Link,
  Lock,
  LockOpen,
  Pencil,
  Search,
  Type,
  Plus,
  SmilePlus,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react'
import { ws } from '@/core/docs/workspace'
import { t } from '@/core/i18n'
import { updateView, type ViewMeta } from '@/core/model/views'
import { href, navigate } from '@/core/store/router'
import { useLayout } from '@/platform/layout'
import { Menu, toast, type MenuEntry } from '@/ui'
import { loadPageExport } from '@/features/io'
import { addPage, duplicatePage, moveToTrash, toggleFavorite } from './actions'
import { openIconPicker, openMoveDialog, openViewInfo } from './overlays'
import { afterMenuClosed, renameView } from './rename'
import { displayTitle } from './titles'

/** Runs a page export (lazy io chunk) and reports the saved file. */
function runExport(kind: 'exportMarkdown' | 'exportHtml', id: string) {
  void loadPageExport()
    .then((m) => m[kind](id))
    .then(
      (name) => toast(t('page.exportDone', { name })),
      (e: unknown) =>
        toast(t('page.exportFailed', { error: e instanceof Error ? e.message : String(e) }), { tone: 'error' }),
    )
}

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
    // M8-05~07: one page out (databases have their own CSV export)
    ...(page.kind === 'database'
      ? []
      : [
          {
            label: t('page.export'),
            icon: Download,
            children: [
              { label: t('page.exportMarkdown'), onSelect: () => runExport('exportMarkdown', page.id) },
              { label: t('page.exportHtml'), onSelect: () => runExport('exportHtml', page.id) },
              {
                label: t('page.print'),
                // the printed page is the open one: open it first, wait for the menu to close
                onSelect: () => {
                  if (where !== 'page') navigate({ name: 'page', id: page.id })
                  void afterMenuClosed().then(() => setTimeout(() => window.print(), where === 'page' ? 0 : 600))
                },
              },
            ],
          },
        ]),
    ...(where === 'page'
      ? [
          {
            label: t('pageStyle.title'),
            icon: Type,
            onSelect: () => void afterMenuClosed().then(() => window.dispatchEvent(new Event('webnota:page-style'))),
          },
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
