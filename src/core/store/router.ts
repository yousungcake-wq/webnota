import { historyBusy, whenHistoryIdle } from '@/platform/history'
import { currentWorkspaceId, listSlots, switchSlot } from '../docs/slots'
import { createStore } from './createStore'
import { shallowEqual } from './equality'
import { useStore } from './useStore'

export type Route =
  | { name: 'home' }
  | { name: 'page'; id: string }
  | { name: 'search' }
  | { name: 'favorites' }
  | { name: 'trash' }
  | { name: 'settings' }

/**
 * Routes (spec/03, M1-17): a view is `#/w/<workspace>/v/<viewId>`. The workspace part is
 * this device's slot id: a link from another device carries an unknown id and simply
 * opens the view in the current workspace; a known other workspace is switched to
 * (reload). PoC links `#/page/<id>` still work and are rewritten.
 */
function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/')
  switch (parts[0]) {
    case 'w': {
      const [, ws, kind, id] = parts
      if (kind !== 'v' || !id) return { name: 'home' }
      if (ws && ws !== currentWorkspaceId() && listSlots().some((s) => s.id === ws)) switchSlot(ws, true)
      return { name: 'page', id: decodeURIComponent(id) }
    }
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
    ? `#/w/${currentWorkspaceId()}/v/${encodeURIComponent(route.id)}`
    : route.name === 'home'
      ? '#/'
      : `#/${route.name}`
}

/** Rewrites legacy / foreign-workspace page URLs to the canonical form, in place. */
function canonicalize(route: Route) {
  if (route.name !== 'page') return
  const canonical = href(route)
  if (location.hash !== canonical) history.replaceState(history.state, '', canonical)
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
  // An overlay that just closed may still be popping its history entry (MB-14); navigating
  // before that pop lands would let the pop undo the navigation.
  if (historyBusy()) {
    void whenHistoryIdle().then(() => navigate(route, opts))
    return
  }
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
  if (historyBusy()) {
    void whenHistoryIdle().then(goBack)
    return
  }
  if (depth > 0) history.back()
  else navigate({ name: 'home' }, { replace: true })
}

const routeStore = createStore<Route>(parse(location.hash))
canonicalize(routeStore.get())
window.addEventListener('hashchange', () => {
  const next = parse(location.hash)
  canonicalize(next)
  routeStore.set((prev) => (shallowEqual(prev, next) ? prev : next))
})

export const useRoute = (): Route => useStore(routeStore)
export const currentRoute = (): Route => routeStore.get()
