import { useEffect, useState } from 'react'

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
