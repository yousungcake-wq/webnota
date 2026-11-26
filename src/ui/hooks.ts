import { useEffect, useState, useSyncExternalStore } from 'react'

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )
}

export type Route =
  | { name: 'home' }
  | { name: 'page'; id: string }
  | { name: 'search' }
  | { name: 'favorites' }
  | { name: 'trash' }
  | { name: 'settings' }

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/')
  switch (parts[0]) {
    case 'page':
      return parts[1] ? { name: 'page', id: decodeURIComponent(parts[1]) } : { name: 'home' }
    case 'search':
    case 'favorites':
    case 'trash':
    case 'settings':
      return { name: parts[0] }
    default:
      return { name: 'home' }
  }
}

export function href(route: Route): string {
  return route.name === 'page'
    ? `#/page/${encodeURIComponent(route.id)}`
    : route.name === 'home'
      ? '#/'
      : `#/${route.name}`
}

/**
 * Each in-app history entry is stamped with its depth, so "back" can tell whether
 * the previous entry belongs to WebNota or to whatever page opened it.
 */
let depth: number = (history.state as { wnDepth?: number } | null)?.wnDepth ?? 0
if ((history.state as { wnDepth?: number } | null)?.wnDepth == null) history.replaceState({ wnDepth: 0 }, '')
window.addEventListener('hashchange', () => {
  const st = history.state as { wnDepth?: number } | null
  if (st?.wnDepth == null) {
    depth += 1
    history.replaceState({ wnDepth: depth }, '')
  } else {
    depth = st.wnDepth
  }
})

export function navigate(route: Route, opts: { replace?: boolean } = {}) {
  const target = href(route)
  if (opts.replace) {
    history.replaceState({ wnDepth: depth }, '', target)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    location.hash = target
  }
}

/** Back within the app; if the app was opened directly on this screen, go to home instead of leaving. */
export function goBack() {
  if (depth > 0) history.back()
  else navigate({ name: 'home' }, { replace: true })
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash))
  useEffect(() => {
    const on = () => setRoute(parse(location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

type Theme = 'system' | 'light' | 'dark'
const THEME_KEY = 'webnota:theme'
const themeListeners = new Set<() => void>()

export function getTheme(): Theme {
  try {
    return (localStorage.getItem(THEME_KEY) as Theme) || 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(t: Theme = getTheme()) {
  const root = document.documentElement
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1b1c1f' : '#ffffff')
}

export function setTheme(t: Theme) {
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    /* ignore */
  }
  applyTheme(t)
  themeListeners.forEach((l) => l())
}

export function useTheme(): Theme {
  return useSyncExternalStore((cb) => {
    themeListeners.add(cb)
    return () => themeListeners.delete(cb)
  }, getTheme)
}

/** Per-device set of expanded tree nodes. */
const EXP_KEY = 'webnota:expanded'
let expanded = new Set<string>(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(EXP_KEY) || '[]') as string[]
    } catch {
      return []
    }
  })(),
)
const expListeners = new Set<() => void>()
export function toggleExpanded(id: string, value?: boolean) {
  const next = new Set(expanded)
  const v = value ?? !next.has(id)
  if (v) next.add(id)
  else next.delete(id)
  expanded = next
  try {
    localStorage.setItem(EXP_KEY, JSON.stringify([...next]))
  } catch {
    /* ignore */
  }
  expListeners.forEach((l) => l())
}
export function useExpanded(): Set<string> {
  return useSyncExternalStore(
    (cb) => {
      expListeners.add(cb)
      return () => expListeners.delete(cb)
    },
    () => expanded,
  )
}
