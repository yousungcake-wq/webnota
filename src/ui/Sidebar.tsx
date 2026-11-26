import { PanelLeftClose, Plus, Search, Settings, Star, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { isAlive } from '../store/pages'
import { usePages } from '../store/workspace'
import { addPage } from './actions'
import { href, type Route } from './hooks'
import { PageListItem, PageTree } from './PageTree'
import { SyncBadge } from './SyncBadge'

export function Sidebar({ route, onClose }: { route: Route; onClose: () => void }) {
  const pages = usePages()
  const currentId = route.name === 'page' ? route.id : undefined
  const favorites = useMemo(() => {
    const byId = new Map(pages.map((p) => [p.id, p]))
    return pages.filter((p) => p.favorite && isAlive(byId, p.id))
  }, [pages])

  return (
    <aside className="sidebar" aria-label="사이드바">
      <div className="sidebar-top">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={22} height={22} />
          <span>WebNota</span>
        </div>
        <button type="button" className="icon-btn sm" aria-label="사이드바 닫기" onClick={onClose}>
          <PanelLeftClose size={16} />
        </button>
      </div>

      <nav className="side-nav">
        <a className={`side-link${route.name === 'search' ? ' is-current' : ''}`} href={href({ name: 'search' })}>
          <Search size={16} /> 검색
        </a>
        <a className={`side-link${route.name === 'settings' ? ' is-current' : ''}`} href={href({ name: 'settings' })}>
          <Settings size={16} /> 설정
        </a>
      </nav>

      <div className="sidebar-scroll">
        {favorites.length > 0 && (
          <section className="section">
            <div className="section-head">
              <span>
                <Star size={12} /> 즐겨찾기
              </span>
            </div>
            <div className="fav-list">
              {favorites.map((p) => (
                <PageListItem key={p.id} page={p} />
              ))}
            </div>
          </section>
        )}
        <section className="section">
          <div className="section-head">
            <span>페이지</span>
            <button type="button" className="icon-btn sm" aria-label="새 페이지" onClick={() => addPage(null)}>
              <Plus size={16} />
            </button>
          </div>
          <PageTree pages={pages} currentId={currentId} />
        </section>
      </div>

      <div className="sidebar-bottom">
        <button type="button" className="side-link" onClick={() => addPage(null)}>
          <Plus size={16} /> 새 페이지
        </button>
        <a className={`side-link${route.name === 'trash' ? ' is-current' : ''}`} href={href({ name: 'trash' })}>
          <Trash2 size={16} /> 휴지통
        </a>
        <div className="sidebar-sync">
          <SyncBadge />
        </div>
      </div>
    </aside>
  )
}
