import type { ViewMeta } from '../views'

/**
 * Tabs of a database view (M5-01, spec/05 §1 tab bar). The first view of a database is the
 * host; every further view of the same database made from its tab bar is a child view of
 * the host with the same `databaseId` (so it also shows under the database in the sidebar,
 * "linked views"). Opening any of them shows the same tabs: host first, then those
 * children in sibling order. `views` must be the live (not trashed) views, sorted.
 */
export function databaseTabs(views: ViewMeta[], viewId: string): { hostId: string; tabs: ViewMeta[] } | null {
  const byId = new Map(views.map((v) => [v.id, v]))
  const view = byId.get(viewId)
  if (!view || view.kind !== 'database' || !view.databaseId) return null
  const parent = view.parentId ? byId.get(view.parentId) : undefined
  const host = parent?.kind === 'database' && parent.databaseId === view.databaseId ? parent : view
  const tabs = [host, ...views.filter((v) => v.parentId === host.id && v.databaseId === host.databaseId)]
  return { hostId: host.id, tabs }
}

/**
 * Index among *all* live children of the host (documents included) that puts a tab at
 * position `to` among the tab children (`moveView` counts every sibling).
 */
export function tabMoveIndex(views: ViewMeta[], hostId: string, tabId: string, to: number): number {
  const children = views.filter((v) => v.parentId === hostId && v.id !== tabId)
  const host = views.find((v) => v.id === hostId)
  const tabs = children.filter((v) => v.databaseId === host?.databaseId)
  if (to >= tabs.length) return tabs.length ? children.indexOf(tabs.at(-1)!) + 1 : children.length
  return children.indexOf(tabs[Math.max(0, to)]!)
}
