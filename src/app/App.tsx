import { Home, Search, Settings, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useViews } from '@/core/store/views'
import { pushRecent } from '@/core/store/prefs'
import { href, navigate, useRoute, type Route } from '@/core/store/router'
import { FavoritesView } from '@/features/favorites'
import { HomeView } from '@/features/home'
import { PageOverlays, PageView } from '@/features/page'
import { PaletteHost, SearchView } from '@/features/search'
import { SettingsView } from '@/features/settings'
import { Sidebar } from '@/features/sidebar'
import { TrashView } from '@/features/trash'
import { useLayout } from '@/platform/layout'
import { t } from '@/core/i18n'
import { EmptyState, ErrorBoundary } from '@/ui'
import { SchemaBanner } from './SchemaBanner'

const LAST_KEY = 'webnota:last-page'

export function App() {
  const route = useRoute()
  const phone = useLayout().layout === 'phone'
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pages = useViews()

  // Remember the last opened page so desktop opens straight into it.
  useEffect(() => {
    if (route.name !== 'page') return
    localStorage.setItem(LAST_KEY, route.id)
    pushRecent(route.id)
  }, [route])
  useEffect(() => {
    if (route.name !== 'home' || phone) return
    const last = localStorage.getItem(LAST_KEY)
    const target = pages.find((p) => p.id === last && !p.deletedAt) ?? pages.find((p) => !p.deletedAt && !p.parentId)
    if (target) navigate({ name: 'page', id: target.id }, { replace: true })
  }, [route.name, phone, pages])

  if (phone)
    return (
      <>
        <PhoneShell route={route} />
        <PageOverlays />
      </>
    )

  return (
    <div className={`desktop${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      {sidebarOpen && (
        <ErrorBoundary compact title={t('error.sidebar')}>
          <Sidebar route={route} onClose={() => setSidebarOpen(false)} />
        </ErrorBoundary>
      )}
      <main className="main">
        <SchemaBanner />
        <ErrorBoundary key={href(route)}>
          <MainContent route={route} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(true)} />
        </ErrorBoundary>
      </main>
      <PageOverlays />
      <PaletteHost />
    </div>
  )
}

function MainContent({
  route,
  sidebarOpen,
  onToggleSidebar,
}: {
  route: Route
  sidebarOpen: boolean
  onToggleSidebar: () => void
}) {
  switch (route.name) {
    case 'page':
      return <PageView id={route.id} sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} />
    case 'search':
      return <SearchView />
    case 'favorites':
      return <FavoritesView />
    case 'trash':
      return <TrashView />
    case 'settings':
      return <SettingsView />
    default:
      return <EmptyState title={t('app.selectPage')} />
  }
}

/** Phone layout modelled on AppFlowy mobile: tab screens + full-screen page editor. */
function PhoneShell({ route }: { route: Route }) {
  if (route.name === 'page') {
    return (
      <div className="phone">
        <SchemaBanner />
        <ErrorBoundary key={route.id}>
          <PageView id={route.id} />
        </ErrorBoundary>
      </div>
    )
  }
  const tabs = [
    { route: { name: 'home' } as Route, label: t('common.home'), icon: Home },
    { route: { name: 'favorites' } as Route, label: t('common.favorites'), icon: Star },
    { route: { name: 'search' } as Route, label: t('common.search'), icon: Search },
    { route: { name: 'settings' } as Route, label: t('common.settings'), icon: Settings },
  ]
  return (
    <div className="phone">
      <SchemaBanner />
      <div className="phone-content">
        <ErrorBoundary key={href(route)}>
          {route.name === 'favorites' ? (
            <FavoritesView />
          ) : route.name === 'search' ? (
            <SearchView autoFocus={false} />
          ) : route.name === 'settings' ? (
            <SettingsView />
          ) : route.name === 'trash' ? (
            <TrashView />
          ) : (
            <HomeView />
          )}
        </ErrorBoundary>
      </div>
      <nav className="tabbar" aria-label={t('app.tabbar')}>
        {tabs.map((t) => {
          const Icon = t.icon
          const active = t.route.name === route.name || (t.route.name === 'settings' && route.name === 'trash')
          return (
            <a
              key={t.label}
              href={href(t.route)}
              className={`tab${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={22} />
              <span>{t.label}</span>
            </a>
          )
        })}
      </nav>
    </div>
  )
}
