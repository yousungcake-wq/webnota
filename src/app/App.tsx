import { Home, Search, Settings, Star } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import { useViews } from '@/core/store/views'
import { pushRecent } from '@/core/store/prefs'
import { wsKey } from '@/core/docs/slots'
import { href, navigate, useRoute, type Route } from '@/core/store/router'
import { loadHome } from '@/features/home'
import { loadPageView, PageOverlays } from '@/features/page'
import { loadSearchView, PaletteHost } from '@/features/search'
import { useLayout } from '@/platform/layout'
import { t } from '@/core/i18n'
import { EmptyState, ErrorBoundary } from '@/ui'
import { DesktopShell } from './DesktopShell'
import { useGlobalShortcuts } from './shortcuts'
import { SchemaBanner } from './SchemaBanner'

const LAST_KEY = wsKey('last-page')

// Screens that are never the first thing shown load on demand (spec/10 §2).
// started right away: the page screen is what desktop shows first
const pageViewChunk = loadPageView()
const PageView = lazy(() => pageViewChunk.then((m) => ({ default: m.PageView })))
const HomeView = lazy(() => loadHome().then((m) => ({ default: m.HomeView })))
const FavoritesView = lazy(() => import('@/features/favorites').then((m) => ({ default: m.FavoritesView })))
const TrashView = lazy(() => import('@/features/trash').then((m) => ({ default: m.TrashView })))
const SearchView = lazy(() => loadSearchView().then((m) => ({ default: m.SearchView })))
const SettingsView = lazy(() => import('@/features/settings').then((m) => ({ default: m.SettingsView })))
const Lazy = ({ children }: { children: ReactNode }) => <Suspense fallback={null}>{children}</Suspense>

export function App() {
  const route = useRoute()
  const layout = useLayout().layout
  const phone = layout === 'phone'
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
    <>
      <DesktopFrame route={route} tablet={layout === 'tablet'} />
      <PageOverlays />
      <PaletteHost />
    </>
  )
}

const ShortcutHelp = lazy(() => import('./ShortcutHelp'))

function DesktopFrame({ route, tablet }: { route: Route; tablet: boolean }) {
  const [help, setHelp] = useState(false)
  const openHelp = useCallback(() => setHelp(true), [])
  useGlobalShortcuts(openHelp)
  return (
    <>
      {help && (
        <Lazy>
          <ShortcutHelp onClose={() => setHelp(false)} />
        </Lazy>
      )}
      <DesktopShell route={route} tablet={tablet}>
        {(hidden, openSidebar) => (
          <>
            <SchemaBanner />
            <ErrorBoundary key={href(route)}>
              <MainContent route={route} sidebarOpen={!hidden} onToggleSidebar={openSidebar} />
            </ErrorBoundary>
          </>
        )}
      </DesktopShell>
    </>
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
      return (
        <Lazy>
          <PageView id={route.id} sidebarOpen={sidebarOpen} onToggleSidebar={onToggleSidebar} />
        </Lazy>
      )
    case 'search':
      return (
        <Lazy>
          <SearchView />
        </Lazy>
      )
    case 'favorites':
      return (
        <Lazy>
          <FavoritesView />
        </Lazy>
      )
    case 'trash':
      return (
        <Lazy>
          <TrashView />
        </Lazy>
      )
    case 'settings':
      return (
        <Lazy>
          <SettingsView />
        </Lazy>
      )
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
          <Lazy>
            <PageView id={route.id} />
          </Lazy>
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
            <Lazy>
              <FavoritesView />
            </Lazy>
          ) : route.name === 'search' ? (
            <Lazy>
              <SearchView autoFocus={false} />
            </Lazy>
          ) : route.name === 'settings' ? (
            <Lazy>
              <SettingsView />
            </Lazy>
          ) : route.name === 'trash' ? (
            <Lazy>
              <TrashView />
            </Lazy>
          ) : (
            <Lazy>
              <HomeView />
            </Lazy>
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
