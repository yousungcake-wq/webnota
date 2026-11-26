import { ChevronRight, Copy, FileText, MoreHorizontal, Plus, Star, StarOff, Trash2 } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import type { PageMeta } from '../store/pages'
import { addPage, displayTitle, duplicatePage, moveToTrash, toggleFavorite } from './actions'
import { href, toggleExpanded, useExpanded } from './hooks'
import { Menu } from './Menu'

export function usePageIndex(pages: PageMeta[]) {
  return useMemo(() => {
    const byId = new Map(pages.map((p) => [p.id, p]))
    const children = new Map<string | null, PageMeta[]>()
    for (const p of pages) {
      if (p.deletedAt) continue
      const key = p.parentId && byId.has(p.parentId) ? p.parentId : null
      if (!children.has(key)) children.set(key, [])
      children.get(key)!.push(p)
    }
    return { byId, children }
  }, [pages])
}

type Index = ReturnType<typeof usePageIndex>

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

const Row = memo(function Row({
  page,
  depth,
  index,
  currentId,
  expanded,
}: {
  page: PageMeta
  depth: number
  index: Index
  currentId?: string
  expanded: Set<string>
}) {
  const kids = index.children.get(page.id) ?? []
  const open = expanded.has(page.id)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)

  return (
    <li role="treeitem" aria-expanded={kids.length ? open : undefined} aria-selected={currentId === page.id}>
      <div className={`tree-row${currentId === page.id ? ' is-current' : ''}`} style={{ paddingLeft: 4 + depth * 16 }}>
        <button
          type="button"
          className={`tree-toggle${open ? ' is-open' : ''}`}
          aria-label={open ? '접기' : '펼치기'}
          onClick={() => toggleExpanded(page.id)}
        >
          {kids.length ? <ChevronRight size={16} /> : <span className="tree-dot" />}
        </button>
        <a className="tree-link" href={href({ name: 'page', id: page.id })}>
          <span className="tree-icon">{page.icon || <FileText size={16} />}</span>
          <span className="tree-title">{displayTitle(page.title)}</span>
        </a>
        <div className="tree-actions">
          <button
            type="button"
            className="icon-btn sm"
            aria-label="더보기"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <MoreHorizontal size={16} />
          </button>
          <button type="button" className="icon-btn sm" aria-label="하위 페이지 추가" onClick={() => addPage(page.id)}>
            <Plus size={16} />
          </button>
        </div>
      </div>
      {menuAnchor && (
        <PageMenu page={page} anchor={menuAnchor} currentId={currentId} onClose={() => setMenuAnchor(null)} />
      )}
      {open && kids.length > 0 && (
        <ul role="group">
          {kids.map((k) => (
            <Row key={k.id} page={k} depth={depth + 1} index={index} currentId={currentId} expanded={expanded} />
          ))}
        </ul>
      )}
    </li>
  )
})

export function PageTree({ pages, currentId }: { pages: PageMeta[]; currentId?: string }) {
  const index = usePageIndex(pages)
  const expanded = useExpanded()
  const roots = index.children.get(null) ?? []
  if (!roots.length) {
    return <p className="tree-empty">페이지가 없습니다</p>
  }
  return (
    <ul className="tree" role="tree">
      {roots.map((p) => (
        <Row key={p.id} page={p} depth={0} index={index} currentId={currentId} expanded={expanded} />
      ))}
    </ul>
  )
}

export function PageListItem({ page, subtitle }: { page: PageMeta; subtitle?: string }) {
  return (
    <a className="list-item" href={href({ name: 'page', id: page.id })}>
      <span className="tree-icon">{page.icon || <FileText size={18} />}</span>
      <span className="list-text">
        <span className="list-title">{displayTitle(page.title)}</span>
        {subtitle && <span className="list-sub">{subtitle}</span>}
      </span>
    </a>
  )
}
