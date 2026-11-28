import { historyBusy, whenHistoryIdle } from '@/platform/history'
import { currentWorkspaceId, listSlots, switchSlot } from '../docs/slots'
import { createStore } from './createStore'
import { shallowEqual } from './equality'
import { useStore } from './useStore'

export type Route =
  | { name: 'home' }
  | { name: 'page'; id: string; block?: string; row?: string }
  | { name: 'search' }
  | { name: 'favorites' }
  | { name: 'trash' }
  | { name: 'settings' }

/**
 * Routes (spec/03, M1-17): a view is `#/w/<workspace>/v/<viewId>`. The workspace part is
 * this device's slot id: a link from another device carries an unknown id and simply
 * opens the view in the current workspace; a known other workspace is switched to
 * (reload). PoC links `#/page/<id>` still work and are rewritten. A block link (ED-F15)
 * appends `/b/<blockId>`.
 */
function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/')
  switch (parts[0]) {
    case 'w': {
      const [, ws, kind, id, b, block] = parts
      if (kind !== 'v' || !id) return { name: 'home' }
      if (ws && ws !== currentWorkspaceId() && listSlots().some((s) => s.id === ws)) switchSlot(ws, true)
      if (b === 'b' && block) return { name: 'page', id: decodeURIComponent(id), block: decodeURIComponent(block) }
      // a database row page (M5-09): #/w/<ws>/v/<view>/r/<row>
      if (b === 'r' && block) return { name: 'page', id: decodeURIComponent(id), row: decodeURIComponent(block) }
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
    ? `#/w/${currentWorkspaceId()}/v/${encodeURIComponent(route.id)}` +
        (route.block ? `/b/${encodeURIComponent(route.block)}` : '') +
        (route.row ? `/r/${encodeURIComponent(route.row)}` : '')
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
    const seq = (history.state as { wnSeq?: number } | null)?.wnSeq
    history.replaceState({ wnDepth: depth, ...(seq != null ? { wnSeq: seq } : {}) }, '', target)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    location.hash = target
  }
}

/**
 * The screens visited in this tab, in order (feedback 10): the in-app back button walks
 * this list instead of trusting the browser history, which overlays and links opened from
 * sheets can leave with extra entries. Each history entry carries its position (`wnSeq`).
 */
const TRAIL_KEY = 'webnota:trail'
let trail: { seq: number; href: string }[] = readTrail()
let seqCounter = trail.reduce((m, e) => Math.max(m, e.seq), 0)
function readTrail(): { seq: number; href: string }[] {
  try {
    const t = JSON.parse(sessionStorage.getItem(TRAIL_KEY) ?? '[]') as unknown
    return Array.isArray(t) ? (t as { seq: number; href: string }[]) : []
  } catch {
    return []
  }
}
function saveTrail() {
  try {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(trail.slice(-100)))
  } catch {
    /* private mode: memory only */
  }
}
/** Records the current history entry in the trail (new entry → push, known one → cut back to it). */
function recordTrail(replace: boolean) {
  const st = (history.state ?? {}) as { wnSeq?: number }
  const known = st.wnSeq != null ? trail.findIndex((e) => e.seq === st.wnSeq) : -1
  if (known >= 0) {
    trail = trail.slice(0, known + 1)
    trail[known] = { seq: st.wnSeq!, href: location.hash }
  } else {
    const seq = ++seqCounter
    history.replaceState({ ...(history.state as object | null), wnSeq: seq }, '')
    if (replace && trail.length) trail[trail.length - 1] = { seq, href: location.hash }
    else trail.push({ seq, href: location.hash })
  }
  saveTrail()
}
recordTrail(false)
window.addEventListener('hashchange', () => recordTrail(false))

/**
 * Phones (MB-14, M7-05): a screen opened first — the welcome page, a link, the last page —
 * gets home underneath it, so the hardware back button goes home before leaving the app.
 */
export function ensureHomeBelow() {
  const st = history.state as { wnDepth?: number; wnOverlay?: number } | null
  if (depth !== 0 || st?.wnOverlay || parse(location.hash).name === 'home') return
  const here = location.hash
  const seq = ++seqCounter
  history.replaceState({ wnDepth: 0, wnSeq: seq }, '', '#/')
  trail = [{ seq, href: '#/' }]
  history.pushState({ wnDepth: 1 }, '', here)
  depth = 1
  recordTrail(false)
}

/** The previous screen of this tab is `route` (so going back reaches it). */
export function previousIs(route: Route) {
  return trail.at(-2)?.href === href(route)
}

/** Back within the app: the previous screen of this tab, or home when there is none. */
export function goBack() {
  if (historyBusy()) {
    void whenHistoryIdle().then(goBack)
    return
  }
  const prev = trail.at(-2)
  if (!prev) return navigate({ name: 'home' }, { replace: true })
  const st = (history.state ?? {}) as { wnSeq?: number; wnOverlay?: number }
  // the usual case: the browser's previous entry is our previous screen
  if (depth > 0 && st.wnSeq === trail.at(-1)?.seq && !st.wnOverlay) {
    history.back()
    return
  }
  trail.pop()
  saveTrail()
  history.replaceState({ wnDepth: depth, wnSeq: prev.seq }, '', prev.href)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/**
 * Leaves a screen opened on top of `route` (a row page over its view, M5-09): back when
 * the previous screen of this tab is that route, else replace — so closing never leaves
 * the app or stacks a duplicate entry.
 */
export function closeTo(route: Route) {
  if (trail.at(-2)?.href === href(route)) goBack()
  else navigate(route, { replace: true })
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
