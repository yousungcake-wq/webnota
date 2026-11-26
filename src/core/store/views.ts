import { useMemo } from 'react'
import { ws } from '../docs/workspace'
import { isAlive, listSpaces, listViews, rootSpaceId, visibleSpaces, type ViewMeta } from '../model/views'
import { spacePrefStore } from './prefs'
import { useStore } from './useStore'
import { shallowEqual, shallowItemsEqual } from './equality'
import { useY } from './useY'

let cache = new Map<string, ViewMeta>()
/**
 * `listViews` with stable item identity: a view whose fields did not change keeps its
 * previous object, so memoized rows (sidebar tree) skip re-rendering.
 */
export function listViewsStable(doc: Parameters<typeof listViews>[0]): ViewMeta[] {
  const next = new Map<string, ViewMeta>()
  const out = listViews(doc).map((v) => {
    const prev = cache.get(v.id)
    const item = prev && shallowEqual(prev, v) ? prev : v
    next.set(v.id, item)
    return item
  })
  cache = next
  return out
}

/** All sidebar views, sorted. Re-renders only when some view's metadata actually changed. */
export function useViews(): ViewMeta[] {
  return useY(ws(), listViewsStable, shallowItemsEqual)
}

/** The space shown in the sidebar: the device's choice if it still exists and is visible, else the first one. */
export function useCurrentSpace(): string {
  const pref = useStore(spacePrefStore)
  const spaces = useSpaces()
  const root = useY(ws(), rootSpaceId)
  return pref && visibleSpaces(spaces).some((s) => s.id === pref) ? pref : root
}

/** All spaces, sorted. */
export function useSpaces() {
  return useY(ws(), listSpaces, shallowItemsEqual)
}

/** All views plus the ones not in the trash (directly or via an ancestor). */
export function useAliveViews() {
  const views = useViews()
  return useMemo(() => {
    const byId = new Map(views.map((p) => [p.id, p]))
    return { views, alive: views.filter((p) => isAlive(byId, p.id)), byId }
  }, [views])
}
