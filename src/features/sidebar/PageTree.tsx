import { ChevronRight, FileText, MoreHorizontal, Plus } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { type PageMeta } from '@/core/model/pages'
import { displayTitle } from '@/features/page'
import { toggleExpanded, useExpanded } from '@/core/store/prefs'
import { href } from '@/core/store/router'
import { addPage, PageMenu } from '@/features/page'
import './tree.css'
import { t } from '@/core/i18n'
import { IconButton } from '@/ui'

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
          aria-label={open ? t('tree.collapse') : t('tree.expand')}
          onClick={() => toggleExpanded(page.id)}
        >
          {kids.length ? <ChevronRight size={16} /> : <span className="tree-dot" />}
        </button>
        <a className="tree-link" href={href({ name: 'page', id: page.id })}>
          <span className="tree-icon">{page.icon || <FileText size={16} />}</span>
          <span className="tree-title">{displayTitle(page.title)}</span>
        </a>
        <div className="tree-actions">
          <IconButton
            size="sm"
            icon={MoreHorizontal}
            label={t('common.more')}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          />
          <IconButton size="sm" icon={Plus} label={t('tree.addChild')} onClick={() => addPage(page.id)} />
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
    return <p className="tree-empty">{t('tree.empty')}</p>
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
