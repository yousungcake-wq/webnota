import { Plus, Settings } from 'lucide-react'
import { useMemo } from 'react'
import { t } from '@/core/i18n'
import { visibleSpaces } from '@/core/model/views'
import { setCurrentSpace, useRecent } from '@/core/store/prefs'
import { href } from '@/core/store/router'
import { useAliveViews, useCurrentSpace, useSpaces } from '@/core/store/views'
import { addPage, displayTitle, ViewIcon } from '@/features/page'
import { PageTree } from '@/features/sidebar'
import { SpaceBadge, SpaceSwitcher } from '@/features/spaces'
import { SyncBadge } from '@/features/sync'
import { WorkspaceSwitcher } from '@/features/workspaces'
import { IconButton, LinkButton } from '@/ui'
import './home.css'

/**
 * Phone home (MB-02, AppFlowy mobile): workspace switcher + settings, space tabs, recent
 * pages as a horizontal strip, the space's page tree and a "+" button.
 */
export function HomeView() {
  const spaceId = useCurrentSpace()
  const spaces = visibleSpaces(useSpaces())
  return (
    <div className="view home">
      <header className="home-top">
        <WorkspaceSwitcher />
        <div className="home-top-actions">
          <SyncBadge compact />
          <LinkButton href={href({ name: 'settings' })} variant="ghost" aria-label={t('common.settings')}>
            <Settings size={20} />
          </LinkButton>
        </div>
      </header>
      {spaces.length > 1 && (
        <nav className="space-tabs" aria-label={t('space.title')}>
          {spaces.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`space-tab${s.id === spaceId ? ' is-active' : ''}`}
              aria-pressed={s.id === spaceId}
              onClick={() => setCurrentSpace(s.id)}
            >
              <SpaceBadge space={s} size={18} />
              <span>{s.name || t('space.untitled')}</span>
            </button>
          ))}
        </nav>
      )}
      <RecentStrip />
      <section className="section">
        <div className="section-head">
          <SpaceSwitcher />
          <IconButton size="sm" icon={Plus} label={t('common.newPage')} onClick={() => addPage(null, spaceId)} />
        </div>
        <PageTree spaceId={spaceId} />
      </section>
      <button type="button" className="fab" aria-label={t('common.newPage')} onClick={() => addPage(null, spaceId)}>
        <Plus size={26} />
      </button>
    </div>
  )
}

/** Recently opened pages (WS-05) as horizontally scrolling cards. */
function RecentStrip() {
  const { alive } = useAliveViews()
  const recent = useRecent()
  const items = useMemo(() => {
    const byId = new Map(alive.map((v) => [v.id, v]))
    return recent.flatMap((id) => byId.get(id) ?? []).slice(0, 10)
  }, [alive, recent])
  if (!items.length) return null
  return (
    <section className="section">
      <div className="section-head">
        <span>{t('home.recent')}</span>
      </div>
      <div className="recent-strip">
        {items.map((v) => (
          <a key={v.id} className="recent-card" href={href({ name: 'page', id: v.id })}>
            <span className="recent-card-icon">
              <ViewIcon icon={v.icon} size={22} />
            </span>
            <span className="recent-card-title">{displayTitle(v.title)}</span>
          </a>
        ))}
      </div>
    </section>
  )
}
