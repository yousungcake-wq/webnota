import type { ViewMeta } from '@/core/model/views'
import { href } from '@/core/store/router'
import { displayTitle, pathOf, ViewIcon } from '@/features/page'
import type { SearchHit } from './engine'
import { Highlight } from './Highlight'

/** One search result: icon, highlighted title, body snippet or path. */
export function ResultItem({
  hit,
  view,
  byId,
  active,
  id,
  onPick,
}: {
  hit: SearchHit
  view: ViewMeta
  byId: Map<string, ViewMeta>
  active?: boolean
  id?: string
  onPick?: (e: React.MouseEvent) => void
}) {
  const path = pathOf(view, byId)
  return (
    <a
      id={id}
      className={`list-item${active ? ' is-active' : ''}`}
      href={href({ name: 'page', id: view.id })}
      role={onPick ? 'option' : undefined}
      aria-selected={onPick ? active : undefined}
      onClick={onPick}
    >
      <span className="tree-icon">
        <ViewIcon icon={view.icon} size={18} />
      </span>
      <span className="list-text">
        <span className="list-title">
          <Highlight text={displayTitle(view.title)} terms={hit.terms} />
        </span>
        {hit.snippet ? (
          <span className="list-sub search-snippet">
            <Highlight text={hit.snippet} terms={hit.terms} />
          </span>
        ) : (
          path && <span className="list-sub">{path}</span>
        )}
      </span>
    </a>
  )
}
