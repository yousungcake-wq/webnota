import { ChevronRight, MoreHorizontal, Plus } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { beginDrag, beginListDrag, keyboardMove, preloadDrag } from './dragStart'
import { useAliveViews, useFavoriteIds, useViews } from '@/core/store/views'
import { flattenTree } from './flatten'
import { useWindow } from './useWindow'
import { type ViewMeta } from '@/core/model/views'
import { displayTitle } from '@/features/page'
import { toggleExpanded, useExpanded } from '@/core/store/prefs'
import { href } from '@/core/store/router'
import { addPage, PageMenu, pathOf, renameStore, renameView, ViewIcon } from '@/features/page'
import { ws } from '@/core/docs/workspace'
import { moveFavorite, updateView } from '@/core/model/views'
import { useStore } from '@/core/store/useStore'
import { useLayout } from '@/platform/layout'
import './tree.css'
import { t } from '@/core/i18n'
import { IconButton } from '@/ui'

interface RowProps {
  view: ViewMeta
  depth: number
  hasChildren: boolean
  open: boolean
  current: boolean
}

/** One tree row. Memoized: re-renders only when its own view or position changes. */
const Row = memo(function Row({ view, depth, hasChildren, open, current, index }: RowProps & { index: number }) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const editing = useStore(renameStore, (r) => r?.id === view.id && r.where === 'tree')
  const phone = useLayout().layout === 'phone'
  return (
    <li
      role="treeitem"
      data-row
      data-id={view.id}
      data-index={index}
      aria-level={depth + 1}
      aria-expanded={hasChildren ? open : undefined}
      aria-selected={current}
    >
      <div className={`tree-row${current ? ' is-current' : ''}`} style={{ paddingLeft: 4 + depth * 16 }}>
        <button
          type="button"
          className={`tree-toggle${open ? ' is-open' : ''}`}
          aria-label={open ? t('tree.collapse') : t('tree.expand')}
          onClick={() => toggleExpanded(view.id)}
        >
          {hasChildren ? <ChevronRight size={16} /> : <span className="tree-dot" />}
        </button>
        <a
          className="tree-link"
          href={href({ name: 'page', id: view.id })}
          draggable={false}
          onKeyDown={(e) => {
            if (e.key === 'F2') {
              e.preventDefault()
              void renameView(view, 'tree', phone)
            } else keyboardMove(e, view)
          }}
          onDoubleClick={(e) => {
            if (phone) return
            e.preventDefault()
            void renameView(view, 'tree', false)
          }}
        >
          <span className="tree-icon">
            <ViewIcon icon={view.icon} />
          </span>
          {editing ? <RenameInput view={view} /> : <span className="tree-title">{displayTitle(view.title)}</span>}
        </a>
        <div className="tree-actions">
          <IconButton
            size="sm"
            icon={MoreHorizontal}
            label={t('common.more')}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          />
          <IconButton size="sm" icon={Plus} label={t('tree.addChild')} onClick={() => addPage(view.id)} />
        </div>
      </div>
      {menuAnchor && <PageMenu page={view} anchor={menuAnchor} onClose={() => setMenuAnchor(null)} />}
    </li>
  )
})

/** Inline title editor in a tree row: Enter/blur saves, Esc cancels. */
function RenameInput({ view }: { view: ViewMeta }) {
  const [value, setValue] = useState(view.title)
  const done = (save: boolean) => {
    if (renameStore.get()?.id !== view.id) return
    renameStore.set(null)
    if (save && value.trim() !== view.title) updateView(ws(), view.id, { title: value.trim() })
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-id="${CSS.escape(view.id)}"] .tree-link`)?.focus(),
    )
  }
  return (
    <input
      className="tree-rename"
      autoFocus
      value={value}
      aria-label={t('page.titleLabel')}
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.preventDefault()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => done(true)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Enter') done(true)
        else if (e.key === 'Escape') done(false)
      }}
    />
  )
}

/**
 * The view tree of one space (WS-03): flattened, then only the rows on screen are
 * rendered once it grows past 50 rows (spec/10 §2).
 */
export function PageTree({ spaceId, currentId }: { spaceId: string; currentId?: string }) {
  const views = useViews()
  const expanded = useExpanded()
  const rows = useMemo(() => flattenTree(views, spaceId, expanded), [views, spaceId, expanded])
  const listRef = useRef<HTMLUListElement>(null)
  const { start, end, rowHeight } = useWindow(listRef, rows.length)
  const latest = useRef({ rows, views })
  useEffect(() => {
    latest.current = { rows, views }
  })
  const onPointerDown = (e: React.PointerEvent<HTMLUListElement>) =>
    beginDrag(
      e,
      listRef.current,
      spaceId,
      () => latest.current.rows,
      () => latest.current.views,
    )
  if (!rows.length) return <p className="tree-empty">{t('tree.empty')}</p>
  return (
    <ul
      ref={listRef}
      className="tree"
      role="tree"
      onPointerEnter={(e) => e.pointerType === 'mouse' && void preloadDrag()}
      onPointerDown={onPointerDown}
      style={{ paddingTop: start * rowHeight, paddingBottom: (rows.length - end) * rowHeight }}
    >
      {rows.slice(start, end).map((r, i) => (
        <Row
          key={r.view.id}
          index={start + i}
          view={r.view}
          depth={r.depth}
          hasChildren={r.hasChildren}
          open={r.open}
          current={r.view.id === currentId}
        />
      ))}
    </ul>
  )
}

export function PageListItem({ page, subtitle }: { page: ViewMeta; subtitle?: string }) {
  return (
    <a className="list-item" href={href({ name: 'page', id: page.id })} data-id={page.id} draggable={false}>
      <span className="tree-icon">
        <ViewIcon icon={page.icon} size={18} />
      </span>
      <span className="list-text">
        <span className="list-title">{displayTitle(page.title)}</span>
        {subtitle && <span className="list-sub">{subtitle}</span>}
      </span>
    </a>
  )
}

/** Favorites in the user's order, reorderable by drag (WS-04). */
export function FavoritesList({
  withPath = false,
  empty,
  header,
}: {
  withPath?: boolean
  empty?: ReactNode
  /** Shown above the list when there are favorites (sidebar section). */
  header?: ReactNode
}) {
  const { alive, byId } = useAliveViews()
  const ids = useFavoriteIds()
  const aliveIds = useMemo(() => new Set(alive.map((v) => v.id)), [alive])
  const favs = ids.filter((id) => aliveIds.has(id)).map((id) => byId.get(id)!)
  const listRef = useRef<HTMLDivElement>(null)
  if (!favs.length) return <>{empty}</>
  const list = (
    <div
      ref={listRef}
      className="fav-list"
      onPointerEnter={(e) => e.pointerType === 'mouse' && void preloadDrag()}
      onPointerDown={(e) =>
        beginListDrag(e, listRef.current, (id, index) =>
          moveFavorite(
            ws(),
            id,
            favs.map((f) => f.id),
            index,
          ),
        )
      }
    >
      {favs.map((p) => (
        <PageListItem key={p.id} page={p} subtitle={withPath ? pathOf(p, byId) || undefined : undefined} />
      ))}
    </div>
  )
  return header ? (
    <section className="section">
      {header}
      {list}
    </section>
  ) : (
    list
  )
}
