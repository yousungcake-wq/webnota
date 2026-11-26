import { PanelLeftClose, Plus, Search, Settings, Star, Trash2 } from 'lucide-react'
import { useCurrentSpace } from '@/core/store/views'
import { href, type Route } from '@/core/store/router'
import { addPage } from '@/features/page'
import { SpaceSwitcher } from '@/features/spaces'
import { SyncBadge } from '@/features/sync'
import { FavoritesList, PageTree } from './PageTree'
import './sidebar.css'
import { t } from '@/core/i18n'
import { IconButton } from '@/ui'
import { debugCrash } from '@/platform/debug'

export function Sidebar({ route, onClose }: { route: Route; onClose: () => void }) {
  debugCrash('sidebar')
  const spaceId = useCurrentSpace()
  const currentId = route.name === 'page' ? route.id : undefined

  return (
    <aside className="sidebar" aria-label={t('sidebar.label')}>
      <div className="sidebar-top">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={22} height={22} />
          <span>WebNota</span>
        </div>
        <IconButton size="sm" icon={PanelLeftClose} label={t('sidebar.close')} onClick={onClose} />
      </div>

      <nav className="side-nav">
        <a className={`side-link${route.name === 'search' ? ' is-current' : ''}`} href={href({ name: 'search' })}>
          <Search size={16} /> {t('common.search')}
        </a>
        <a className={`side-link${route.name === 'settings' ? ' is-current' : ''}`} href={href({ name: 'settings' })}>
          <Settings size={16} /> {t('common.settings')}
        </a>
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
        <section className="section">
          <div className="section-head">
            <SpaceSwitcher />
            <IconButton size="sm" icon={Plus} label={t('common.newPage')} onClick={() => addPage(null, spaceId)} />
          </div>
          <PageTree spaceId={spaceId} currentId={currentId} />
        </section>
      </div>

      <div className="sidebar-bottom">
        <button type="button" className="side-link" onClick={() => addPage(null, spaceId)}>
          <Plus size={16} /> {t('common.newPage')}
        </button>
        <a className={`side-link${route.name === 'trash' ? ' is-current' : ''}`} href={href({ name: 'trash' })}>
          <Trash2 size={16} /> {t('common.trash')}
        </a>
        <div className="sidebar-sync">
          <SyncBadge />
        </div>
      </div>
    </aside>
  )
}
