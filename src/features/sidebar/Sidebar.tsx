import { useEffect } from 'react'
import { PanelLeftClose, Search, Settings, Star, Trash2 } from 'lucide-react'
import { href, type Route } from '@/core/store/router'
import { openPalette } from '@/features/search'
import { SyncBadge } from '@/features/sync'
import { WorkspaceSwitcher } from '@/features/workspaces'
import { preloadDrag } from './dragStart'
import { FavoritesList } from './PageTree'
import { SpaceSections } from './SpaceSections'
import './sidebar.css'
import { t } from '@/core/i18n'
import { IconButton } from '@/ui'
import { debugCrash } from '@/platform/debug'

/**
 * Desktop sidebar (feedback 7, Notion-like): the WebNota brand on top, search, favorites,
 * then every space with its pages (foldable, draggable); settings, trash and the
 * workspace switcher at the bottom.
 */
export function Sidebar({ route, onClose }: { route: Route; onClose: () => void }) {
  debugCrash('sidebar')
  // Drag & drop starts synchronously only once its module is loaded: warm it when idle.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1000))
    idle(() => void preloadDrag())
  }, [])
  const currentId = route.name === 'page' ? route.id : undefined

  return (
    <aside className="sidebar" aria-label={t('sidebar.label')}>
      <div className="sidebar-top">
        <a className="brand" href={href({ name: 'home' })}>
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={22} height={22} />
          WebNota
        </a>
        <IconButton size="sm" icon={PanelLeftClose} label={t('sidebar.close')} onClick={onClose} />
      </div>

      <nav className="side-nav">
        <button type="button" className="side-link" onClick={openPalette} aria-keyshortcuts="Control+K Meta+K">
          <Search size={16} /> {t('common.search')}
          <kbd className="side-kbd">{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
      </nav>

      <div className="sidebar-scroll">
        <FavoritesList
          header={
            <div className="section-head">
              <span>
                <Star size={12} /> {t('common.favorites')}
              </span>
            </div>
          }
        />
        <SpaceSections currentId={currentId} />
      </div>

      <div className="sidebar-bottom">
        <a className={`side-link${route.name === 'settings' ? ' is-current' : ''}`} href={href({ name: 'settings' })}>
          <Settings size={16} /> {t('common.settings')}
        </a>
        <a className={`side-link${route.name === 'trash' ? ' is-current' : ''}`} href={href({ name: 'trash' })}>
          <Trash2 size={16} /> {t('common.trash')}
        </a>
        <div className="sidebar-ws">
          <WorkspaceSwitcher />
        </div>
        <div className="sidebar-sync">
          <SyncBadge />
        </div>
      </div>
    </aside>
  )
}
