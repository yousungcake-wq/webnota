import { CalendarDays, Copy, KanbanSquare, Pencil, Plus, Table2, Trash2, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { ws } from '@/core/docs/workspace'
import { t } from '@/core/i18n'
import {
  addDbView,
  databaseTabs,
  duplicateDbView,
  tabMoveIndex,
  type DbDocs,
  type DbLayout,
} from '@/core/model/database'
import { createView, moveView, restoreView, trashView, updateView, type ViewMeta } from '@/core/model/views'
import { toggleExpanded } from '@/core/store/prefs'
import { navigate } from '@/core/store/router'
import { useAliveViews } from '@/core/store/views'
import { displayTitle } from '@/features/page'
import { Menu, promptDialog, toast, type MenuEntry } from '@/ui'
import { dt } from './i18n'
import { useReorder } from './useReorder'

export const LAYOUT_ICONS: Record<DbLayout, LucideIcon> = { grid: Table2, board: KanbanSquare, calendar: CalendarDays }
export const layoutName = (l: DbLayout) => t(`newView.${l}` as const)
const LAYOUTS: DbLayout[] = ['grid', 'board', 'calendar']

/**
 * Tab bar of a database (M5-01, spec/05 §1): every view of the database, the current one
 * selected. "+" adds a view of a chosen layout; the selected tab's menu (click it again,
 * right-click, long-press) renames, duplicates or deletes; tabs after the first drag to
 * reorder. Each tab is a real workspace view, so switching tabs is navigation.
 */
export function DbTabs({ viewId, docs, readOnly }: { viewId: string; docs: DbDocs; readOnly: boolean }) {
  const { alive } = useAliveViews()
  const tabs = databaseTabs(alive, viewId)
  const [menu, setMenu] = useState<{ anchor: HTMLElement; tab?: ViewMeta } | null>(null)
  const reorder = useReorder(
    (from, to) => {
      if (!tabs) return
      const tab = tabs.tabs[from + 1]!
      moveView(ws(), tab.id, { parentId: tabs.hostId, index: tabMoveIndex(alive, tabs.hostId, tab.id, to) })
    },
    { axis: 'x', threshold: 6 },
  )
  if (!tabs) return null
  const { hostId } = tabs
  const databaseId = tabs.tabs[0]!.databaseId!

  const add = (layout: DbLayout) => {
    const id = createView(ws(), { parentId: hostId, kind: 'database', layout, databaseId, title: layoutName(layout) })
    addDbView(docs, id, layout)
    toggleExpanded(hostId, true)
    navigate({ name: 'page', id })
  }
  const duplicate = (tab: ViewMeta) => {
    const title = t('page.copySuffix', { title: displayTitle(tab.title) })
    // copies sit among the host's children: right after the tab, or first for the host
    const id = createView(ws(), {
      parentId: hostId,
      kind: 'database',
      layout: tab.layout,
      databaseId,
      title,
      icon: tab.icon,
      ...(tab.id === hostId ? {} : { after: tab.id }),
    })
    if (tab.id === hostId) moveView(ws(), id, { parentId: hostId, index: tabMoveIndex(alive, hostId, id, 0) })
    duplicateDbView(docs, tab.id, id)
    toggleExpanded(hostId, true)
    navigate({ name: 'page', id })
  }
  const rename = async (tab: ViewMeta) => {
    const title = await promptDialog({ title: dt('db.tabs.rename'), label: dt('db.tabs.name'), value: tab.title })
    if (title !== null && title.trim()) updateView(ws(), tab.id, { title: title.trim() })
  }
  const remove = (tab: ViewMeta) => {
    trashView(ws(), tab.id)
    toast(t('page.movedToTrash', { title: displayTitle(tab.title) }), {
      action: { label: t('common.undo'), onClick: () => restoreView(ws(), tab.id) },
    })
    if (tab.id === viewId) navigate({ name: 'page', id: hostId }, { replace: true })
  }

  const tabMenu = (tab: ViewMeta): MenuEntry[] => [
    { label: dt('db.tabs.rename'), icon: Pencil, onSelect: () => void rename(tab) },
    { label: dt('db.tabs.duplicate'), icon: Copy, onSelect: () => duplicate(tab) },
    // the first tab is the database page itself: delete it from the sidebar
    ...(tab.id === hostId
      ? []
      : ([
          'separator',
          { label: dt('db.tabs.delete'), icon: Trash2, danger: true, onSelect: () => remove(tab) },
        ] as MenuEntry[])),
  ]
  const addMenu: MenuEntry[] = LAYOUTS.map((l) => ({
    label: layoutName(l),
    icon: LAYOUT_ICONS[l],
    onSelect: () => add(l),
  }))

  return (
    <div className="db-tabs" role="tablist" aria-label={dt('db.tabs.label')}>
      {tabs.tabs.map((tab, i) => {
        const Icon = LAYOUT_ICONS[tab.layout as DbLayout] ?? Table2
        const selected = tab.id === viewId
        const drag = i > 0 && !readOnly ? reorder.handle(i - 1) : undefined
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`db-tab${selected ? ' is-selected' : ''}`}
            data-reorder-item={i > 0 ? '' : undefined}
            data-view-id={tab.id}
            style={i > 0 ? reorder.style(i - 1) : undefined}
            {...drag}
            onClick={(e) => {
              if (reorder.wasDrag()) return
              if (!selected) navigate({ name: 'page', id: tab.id })
              else if (!readOnly) setMenu({ anchor: e.currentTarget, tab })
            }}
            onContextMenu={(e) => {
              if (readOnly) return
              e.preventDefault()
              setMenu({ anchor: e.currentTarget, tab })
            }}
          >
            <Icon size={14} aria-hidden />
            <span className="db-tab-title">{displayTitle(tab.title)}</span>
          </button>
        )
      })}
      {!readOnly && (
        <button
          type="button"
          className="db-tab-add"
          aria-label={dt('db.tabs.add')}
          title={dt('db.tabs.add')}
          onClick={(e) => setMenu({ anchor: e.currentTarget })}
        >
          <Plus size={14} aria-hidden />
        </button>
      )}
      {menu && (
        <Menu
          anchor={menu.anchor}
          title={menu.tab ? displayTitle(menu.tab.title) : dt('db.tabs.add')}
          items={menu.tab ? tabMenu(menu.tab) : addMenu}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}
