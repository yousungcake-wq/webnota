import { ChevronRight, MoreHorizontal, Plus } from 'lucide-react'
import { memo, useMemo, useRef, useState } from 'react'
import { useViews } from '@/core/store/views'
import { flattenTree } from './flatten'
import { useWindow } from './useWindow'
import { type ViewMeta } from '@/core/model/views'
import { displayTitle } from '@/features/page'
import { toggleExpanded, useExpanded } from '@/core/store/prefs'
import { href } from '@/core/store/router'
import { addPage, PageMenu, ViewIcon } from '@/features/page'
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
const Row = memo(function Row({ view, depth, hasChildren, open, current }: RowProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  return (
    <li
      role="treeitem"
      data-row
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
        <a className="tree-link" href={href({ name: 'page', id: view.id })}>
          <span className="tree-icon">
            <ViewIcon icon={view.icon} />
          </span>
          <span className="tree-title">{displayTitle(view.title)}</span>
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
  if (!rows.length) return <p className="tree-empty">{t('tree.empty')}</p>
  return (
    <ul
      ref={listRef}
      className="tree"
      role="tree"
      style={{ paddingTop: start * rowHeight, paddingBottom: (rows.length - end) * rowHeight }}
    >
      {rows.slice(start, end).map((r) => (
        <Row
          key={r.view.id}
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
    <a className="list-item" href={href({ name: 'page', id: page.id })}>
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
