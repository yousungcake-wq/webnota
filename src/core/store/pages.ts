import { useMemo } from 'react'
import { ws } from '../docs/workspace'
import { isAlive, listPages, type PageMeta } from '../model/pages'
import { shallowItemsEqual } from './equality'
import { useY } from './useY'

/** All page metadata, sorted. Re-renders only when some page's metadata actually changed. */
export function usePages(): PageMeta[] {
  return useY(ws(), listPages, shallowItemsEqual)
}

/** All pages plus the ones not in the trash (directly or via an ancestor). */
export function useAlivePages() {
  const pages = usePages()
  return useMemo(() => {
    const byId = new Map(pages.map((p) => [p.id, p]))
    return { pages, alive: pages.filter((p) => isAlive(byId, p.id)), byId }
  }, [pages])
}
