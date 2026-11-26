/** Middle-collapses a breadcrumb trail (WS-09): keeps the first and the last two. */
export function collapseCrumbs<T>(items: T[], max = 3): { head: T[]; hidden: T[]; tail: T[] } {
  if (items.length <= max) return { head: items, hidden: [], tail: [] }
  return { head: items.slice(0, 1), hidden: items.slice(1, -2), tail: items.slice(-2) }
}
