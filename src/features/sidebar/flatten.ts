import type { ViewMeta } from '@/core/model/views'

export interface TreeRow {
  view: ViewMeta
  depth: number
  hasChildren: boolean
  open: boolean
}

/** Visible rows of a space's tree, depth-first, for a virtualized list (WS-03). */
export function flattenTree(views: ViewMeta[], spaceId: string, expanded: Set<string>): TreeRow[] {
  const children = new Map<string, ViewMeta[]>()
  const roots: ViewMeta[] = []
  for (const v of views) {
    if (v.deletedAt || v.spaceId !== spaceId) continue
    if (v.parentId) children.set(v.parentId, [...(children.get(v.parentId) ?? []), v])
    else roots.push(v)
  }
  const out: TreeRow[] = []
  const walk = (list: ViewMeta[], depth: number) => {
    for (const view of list) {
      const kids = children.get(view.id) ?? []
      const open = kids.length > 0 && expanded.has(view.id)
      out.push({ view, depth, hasChildren: kids.length > 0, open })
      if (open) walk(kids, depth + 1)
    }
  }
  walk(roots, 0)
  return out
}
