import { descendantsOf, type ViewMeta } from '@/core/model/views'
import type { TreeRow } from './flatten'

export type Zone = 'before' | 'inside' | 'after'

/** Where on a row the pointer is: top quarter, middle half, bottom quarter. */
export function zoneAt(offsetY: number, rowHeight: number): Zone {
  if (offsetY < rowHeight * 0.25) return 'before'
  if (offsetY > rowHeight * 0.75) return 'after'
  return 'inside'
}

export interface DropTarget {
  /** New parent view (null = the space root). */
  parentId: string | null
  /** Index among the parent's live children, excluding the dragged view. */
  index: number
  /** Indentation level for the drop indicator. */
  depth: number
}

/** Translates "over row N, zone Z" into a move target for `moveView` (WS-03). */
export function dropTarget(
  rows: TreeRow[],
  views: ViewMeta[],
  over: number,
  zone: Zone,
  dragged: string,
): DropTarget | null {
  const row = rows[over]
  if (!row) return null
  const blocked = new Set([dragged, ...descendantsOf(views, dragged)])
  const childrenOf = (parentId: string | null) =>
    views.filter((v) => !v.deletedAt && v.parentId === parentId && v.spaceId === row.view.spaceId && v.id !== dragged)

  let parentId: string | null
  let index: number
  if (zone === 'inside' || (zone === 'after' && row.open)) {
    parentId = row.view.id
    index = zone === 'inside' ? childrenOf(parentId).length : 0
  } else {
    parentId = row.view.parentId
    const sibs = childrenOf(parentId)
    const at = sibs.findIndex((s) => s.id === row.view.id)
    if (at < 0) return null // the row is the dragged view
    index = zone === 'before' ? at : at + 1
  }
  if (parentId && blocked.has(parentId)) return null
  if (blocked.has(row.view.id) && zone !== 'before' && zone !== 'after') return null
  if (row.view.id === dragged) return null
  return { parentId, index, depth: parentId ? row.depth + (parentId === row.view.id ? 1 : 0) : 0 }
}
