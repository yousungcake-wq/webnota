import { useMemo, useSyncExternalStore } from 'react'
import { getPagesSnapshot, subscribePages } from '../docs/workspace'
import { isAlive, type PageMeta } from '../model/pages'

export function usePages(): PageMeta[] {
  return useSyncExternalStore(subscribePages, getPagesSnapshot)
}

/** All pages plus the ones not in the trash (directly or via an ancestor). */
export function useAlivePages() {
  const pages = usePages()
  return useMemo(() => {
    const byId = new Map(pages.map((p) => [p.id, p]))
    return { pages, alive: pages.filter((p) => isAlive(byId, p.id)), byId }
  }, [pages])
}
