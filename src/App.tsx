import { Home, Search, Settings, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePages } from './store/workspace'
import { href, navigate, useMedia, useRoute, type Route } from './ui/hooks'
import { PageView } from './ui/PageView'
import { Sidebar } from './ui/Sidebar'
import { FavoritesView, HomeView, SearchView, SettingsView, TrashView } from './ui/Views'

const LAST_KEY = 'webnota:last-page'

export function App() {
  const route = useRoute()
  const phone = useMedia('(max-width: 767px)')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pages = usePages()

  // Remember the last opened page so desktop opens straight into it.
  useEffect(() => {
    if (route.name === 'page') localStorage.setItem(LAST_KEY, route.id)
  }, [route])
  useEffect(() => {
    if (route.name !== 'home' || phone) return
    const last = localStorage.getItem(LAST_KEY)
    const target = pages.find((p) => p.id === last && !p.deletedAt) ?? pages.find((p) => !p.deletedAt && !p.parentId)
    if (target) navigate({ name: 'page', id: target.id }, { replace: true })
  }, [route.name, phone, pages])

  if (phone) return <PhoneShell route={route} />

  return (
    <div className={`desktop${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      {sidebarOpen && <Sidebar route={route} onClose={() => setSidebarOpen(false)} />}
      <main className="main">
        <MainContent route={route} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(true)} />
      </main>
    </div>
  )
}

function MainContent({ route, sidebarOpen, onToggleSidebar }: { route: Route; sidebarOpen: boolean; onToggleSidebar: () => void }) {
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
      return (
        <div className="empty-state">
          <p>왼쪽에서 페이지를 선택하거나 새 페이지를 만드세요.</p>
        </div>
      )
  }
}

/** Phone layout modelled on AppFlowy mobile: tab screens + full-screen page editor. */
function PhoneShell({ route }: { route: Route }) {
  if (route.name === 'page') {
    return (
      <div className="phone">
        <PageView id={route.id} />
      </div>
    )
  }
  const tabs = [
    { route: { name: 'home' } as Route, label: '홈', icon: Home },
    { route: { name: 'favorites' } as Route, label: '즐겨찾기', icon: Star },
    { route: { name: 'search' } as Route, label: '검색', icon: Search },
    { route: { name: 'settings' } as Route, label: '설정', icon: Settings },
  ]
  return (
    <div className="phone">
      <div className="phone-content">
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
      </div>
      <nav className="tabbar" aria-label="하단 메뉴">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = t.route.name === route.name || (t.route.name === 'settings' && route.name === 'trash')
          return (
            <a key={t.label} href={href(t.route)} className={`tab${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
              <Icon size={22} />
              <span>{t.label}</span>
            </a>
          )
        })}
      </nav>
    </div>
  )
}
