import { ChevronRight, MoreHorizontal, Plus } from 'lucide-react'
import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { beginDrag, beginListDrag, keyboardMove, preloadDrag } from './dragStart'
import { useAliveViews, useFavoriteIds, useViews } from '@/core/store/views'
import { flattenTree } from './flatten'
import { useWindow } from './useWindow'
import { type ViewMeta } from '@/core/model/views'
import { displayTitle } from '@/features/page'
import { toggleExpanded, useExpanded } from '@/core/store/prefs'
import { href } from '@/core/store/router'
import { newView, PageMenu, pathOf, renameStore, renameView, ViewIcon } from '@/features/page'
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

/** Swipe actions on phones (MB-13): its own chunk. */
const TreeSwipe = lazy(() => import('./TreeSwipe'))

/** One tree row. Memoized: re-renders only when its own view or position changes. */
const INDENT = 16

const Row = memo(function Row({
  view,
  depth,
  hasChildren,
  open,
  current,
  index,
  maxDepth,
}: RowProps & { index: number; maxDepth: number }) {
  // Deep pages (feedback 7): indentation stops at `maxDepth` so the title, "⋯" and "+"
  // always fit; deeper levels show one "·" per extra level before the icon instead.
  const shown = Math.min(depth, maxDepth)
  const extra = depth - shown
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
      <div className={`tree-row${current ? ' is-current' : ''}`} style={{ paddingLeft: 4 + shown * INDENT }}>
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
          {extra > 0 && (
            <span className="tree-depth" aria-hidden>
              {'·'.repeat(extra)}
            </span>
          )}
          <span className="tree-icon">
            <ViewIcon icon={view.icon} layout={view.layout} />
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
          <IconButton
            size="sm"
            icon={Plus}
            label={t('tree.addChild')}
            onClick={(e) => newView(e.currentTarget, view.id)}
          />
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
  const maxDepth = useMaxDepth(listRef)
  const latest = useRef({ rows, views })
  useEffect(() => {
    latest.current = { rows, views }
  })
  const held = useHeldMenu(listRef, (id) => latest.current.views.find((v) => v.id === id))
  const phone = useLayout().layout === 'phone'
  const onPointerDown = (e: React.PointerEvent<HTMLUListElement>) => {
    held.pointer(e)
    beginDrag(
      e,
      listRef.current,
      spaceId,
      () => latest.current.rows,
      () => latest.current.views,
      held.open,
    )
  }
  if (!rows.length) return <p className="tree-empty">{t('tree.empty')}</p>
  return (
    <ul
      ref={listRef}
      className="tree"
      role="tree"
      onPointerEnter={(e) => e.pointerType === 'mouse' && void preloadDrag()}
      onPointerDown={onPointerDown}
      onContextMenu={held.contextMenu}
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
          maxDepth={maxDepth}
        />
      ))}
      {held.menu}
      {phone && (
        <Suspense fallback={null}>
          <TreeSwipe listRef={listRef} />
        </Suspense>
      )}
    </ul>
  )
}

/**
 * The menu of a held item (MB-12, M7-03): a touch long press released without moving, or a
 * right click with the mouse. The browser's own long-press menu (link preview) is blocked.
 */
function useHeldMenu(listRef: React.RefObject<HTMLElement | null>, viewOf: (id: string) => ViewMeta | undefined) {
  const [held, setHeld] = useState<{ view: ViewMeta; anchor: HTMLElement } | null>(null)
  const lastPointer = useRef('mouse')
  const open = (id: string) => {
    const view = viewOf(id)
    const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)
    if (!view || !el) return
    setHeld({ view, anchor: el.querySelector<HTMLElement>('.tree-row, .list-item') ?? el })
  }
  return {
    open,
    pointer: (e: React.PointerEvent) => {
      lastPointer.current = e.pointerType
    },
    contextMenu: (e: React.MouseEvent) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id
      if (!id || (e.target as HTMLElement).closest('input, textarea')) return
      e.preventDefault()
      if (lastPointer.current === 'mouse') open(id)
    },
    menu: held && <PageMenu page={held.view} anchor={held.anchor} onClose={() => setHeld(null)} />,
  }
}

/** How deep rows may indent in a list this wide: room is kept for toggle, icon, ~70px of title and the actions. */
function useMaxDepth(ref: React.RefObject<HTMLElement | null>) {
  const [max, setMax] = useState(8)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setMax(Math.max(1, Math.floor((el.clientWidth - 190) / INDENT)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return max
}

export function PageListItem({ page, subtitle }: { page: ViewMeta; subtitle?: string }) {
  return (
    <a className="list-item" href={href({ name: 'page', id: page.id })} data-id={page.id} draggable={false}>
      <span className="tree-icon">
        <ViewIcon icon={page.icon} size={18} layout={page.layout} />
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
  const held = useHeldMenu(listRef, (id) => byId.get(id))
  if (!favs.length) return <>{empty}</>
  const list = (
    <div
      ref={listRef}
      className="fav-list"
      onPointerEnter={(e) => e.pointerType === 'mouse' && void preloadDrag()}
      onContextMenu={held.contextMenu}
      onPointerDown={(e) => {
        held.pointer(e)
        beginListDrag(
          e,
          listRef.current,
          (id, index) =>
            moveFavorite(
              ws(),
              id,
              favs.map((f) => f.id),
              index,
            ),
          'id',
          held.open,
        )
      }}
    >
      {favs.map((p) => (
        <PageListItem key={p.id} page={p} subtitle={withPath ? pathOf(p, byId) || undefined : undefined} />
      ))}
      {held.menu}
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
