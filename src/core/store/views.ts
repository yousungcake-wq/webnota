import { useMemo } from 'react'
import { ws } from '../docs/workspace'
import { isAlive, listSpaces, listViews, type ViewMeta } from '../model/views'
import { shallowItemsEqual } from './equality'
import { useY } from './useY'

/** All sidebar views, sorted. Re-renders only when some view's metadata actually changed. */
export function useViews(): ViewMeta[] {
  return useY(ws(), listViews, shallowItemsEqual)
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
