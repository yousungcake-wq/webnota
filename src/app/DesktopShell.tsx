import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { t } from '@/core/i18n'
import { setSidebar, SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, sidebarStore } from '@/core/store/prefs'
import { href, type Route } from '@/core/store/router'
import { useStore } from '@/core/store/useStore'
import { Sidebar } from '@/features/sidebar'
import { PanelLeft } from 'lucide-react'
import { ErrorBoundary, IconButton } from '@/ui'

/**
 * Desktop and tablet frame (WS-10):
 * - desktop: docked sidebar with a drag handle (200–480px, per device), ⌘/Ctrl+\ collapses;
 *   when collapsed, hovering the left edge slides it in as an overlay;
 * - tablet: overlay drawer, opened by the toolbar button or a swipe from the left edge.
 */
export function DesktopShell({
  route,
  tablet,
  children,
}: {
  route: Route
  tablet: boolean
  children: (sidebarHidden: boolean, openSidebar: () => void) => ReactNode
}) {
  const { open, width } = useStore(sidebarStore)
  const docked = !tablet && open
  // The overlay remembers the route it was opened on, so navigating closes it.
  const routeKey = href(route)
  const [opened, setOpened] = useState<{ kind: 'hover' | 'drawer'; at: string } | null>(null)
  // a docked sidebar never shows the overlay too (feedback 6: two sidebars at once)
  const overlay = !docked && opened?.at === routeKey ? opened.kind : null
  // the overlay slides out before it unmounts (feedback 6)
  const [closing, setClosing] = useState<'hover' | 'drawer' | null>(null)
  const setOverlay = (kind: 'hover' | 'drawer' | null) => {
    if (!kind && overlay) {
      setClosing(overlay)
      setTimeout(() => setClosing(null), 180)
    }
    setOpened(kind ? { kind, at: routeKey } : null)
  }
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Keyboard toggle (WS-14) and closing the drawer on navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        if (tablet) setOpened((o) => (o?.at === routeKey ? null : { kind: 'drawer', at: routeKey }))
        else setSidebar({ open: !sidebarStore.get().open })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tablet, routeKey])

  // Hover peek closes once the pointer moves well away from it (it may appear under a
  // pointer that never "enters" it, so pointerleave alone is not enough).
  useEffect(() => {
    if (overlay !== 'hover') return
    const move = (e: PointerEvent) => {
      if (e.clientX > sidebarStore.get().width + 40) {
        if (!leaveTimer.current)
          leaveTimer.current = setTimeout(() => {
            setClosing('hover')
            setTimeout(() => setClosing(null), 180)
            setOpened(null)
          }, 300)
      } else {
        clearTimeout(leaveTimer.current)
        leaveTimer.current = undefined
      }
    }
    window.addEventListener('pointermove', move)
    return () => {
      window.removeEventListener('pointermove', move)
      clearTimeout(leaveTimer.current)
      leaveTimer.current = undefined
    }
  }, [overlay])

  // Hovering an "open sidebar" button peeks the sidebar too (Notion-like, feedback 6).
  useEffect(() => {
    if (tablet || docked) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const on = (e.target as HTMLElement | null)?.closest?.('[data-sidebar-peek]')
      clearTimeout(timer)
      if (on) timer = setTimeout(() => setOpened({ kind: 'hover', at: routeKey }), 120)
    }
    document.addEventListener('pointerover', over)
    return () => {
      document.removeEventListener('pointerover', over)
      clearTimeout(timer)
    }
  }, [tablet, docked, routeKey])

  // Tablet: swipe right from the left edge opens the drawer.
  useEffect(() => {
    if (!tablet) return
    let start: { x: number; y: number } | null = null
    const down = (e: TouchEvent) => {
      const t0 = e.touches[0]
      start = t0 && t0.clientX < 24 ? { x: t0.clientX, y: t0.clientY } : null
    }
    const move = (e: TouchEvent) => {
      const t1 = e.touches[0]
      if (!start || !t1) return
      if (t1.clientX - start.x > 60 && Math.abs(t1.clientY - start.y) < 40) {
        setOpened({ kind: 'drawer', at: routeKey })
        start = null
      }
    }
    window.addEventListener('touchstart', down, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    return () => {
      window.removeEventListener('touchstart', down)
      window.removeEventListener('touchmove', move)
    }
  }, [tablet, routeKey])

  const sidebar = (onClose: () => void) => (
    <ErrorBoundary compact title={t('error.sidebar')}>
      <Sidebar route={route} onClose={onClose} />
    </ErrorBoundary>
  )

  return (
    <div
      className={`desktop${docked ? '' : ' sidebar-collapsed'}${tablet ? ' is-tablet' : ''}`}
      style={{ '--side-w': `${width}px` } as CSSProperties}
    >
      {!tablet && (
        // stays mounted while collapsed so folding animates (feedback 6); inert when hidden
        <div className="sidebar-dock" inert={!docked} aria-hidden={!docked || undefined}>
          {sidebar(() => {
            setOpened(null)
            setSidebar({ open: false })
          })}
          {docked && <Resizer width={width} />}
        </div>
      )}
      {!docked && !tablet && <div className="sidebar-hover-zone" onPointerEnter={() => setOverlay('hover')} />}
      {!docked && !tablet && route.name !== 'page' && (
        <IconButton
          className="sidebar-open-btn"
          icon={PanelLeft}
          label={t('sidebar.open')}
          data-sidebar-peek
          onClick={() => {
            setOpened(null)
            setSidebar({ open: true })
          }}
        />
      )}
      {(overlay || closing) && (
        <>
          {(overlay ?? closing) === 'drawer' && <div className="sidebar-backdrop" onClick={() => setOverlay(null)} />}
          <div className={`sidebar-overlay is-${overlay ?? closing}${overlay ? '' : ' is-closing'}`}>
            {sidebar(() => setOverlay(null))}
          </div>
        </>
      )}
      <main className="main">
        {children(!docked, () => (tablet ? setOverlay('drawer') : setSidebar({ open: true })))}
      </main>
    </div>
  )
}

function Resizer({ width }: { width: number }) {
  return (
    <div
      className="sidebar-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={t('sidebar.resize')}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      aria-valuenow={width}
      tabIndex={0}
      onDoubleClick={() => setSidebar({ width: SIDEBAR_DEFAULT })}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowLeft' ? -16 : e.key === 'ArrowRight' ? 16 : 0
        if (step) setSidebar({ width: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width + step)) })
      }}
      onPointerDown={(e) => {
        e.preventDefault()
        const x0 = e.clientX
        const w0 = width
        const root = e.currentTarget.closest<HTMLElement>('.desktop')!
        let w = w0
        const move = (ev: PointerEvent) => {
          w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w0 + ev.clientX - x0))
          root.style.setProperty('--side-w', `${w}px`) // live, without re-rendering React
        }
        const up = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
          document.body.classList.remove('is-resizing')
          setSidebar({ width: w })
        }
        document.body.classList.add('is-resizing')
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
    />
  )
}
