import type { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'

/**
 * Ranges of the new document a transaction touched (spec/10 §2: decoration plugins
 * recompute only what changed). Each step's changed range is mapped through the
 * steps after it.
 */
export function changedRanges(tr: Transaction): [number, number][] {
  const out: [number, number][] = []
  const maps = tr.mapping.maps
  maps.forEach((map, i) => {
    const rest = tr.mapping.slice(i + 1)
    map.forEach((_os, _oe, ns, ne) => out.push([rest.map(ns, -1), rest.map(ne, 1)]))
  })
  return out
}

/** Nodes of `typeName` that contain or overlap one of `ranges` (deduplicated, document order). */
export function blocksInRanges(doc: PMNode, ranges: [number, number][], typeName: string) {
  const seen = new Map<number, PMNode>()
  for (const [from, to] of ranges) {
    const a = Math.max(0, Math.min(from, to) - 1)
    const b = Math.min(doc.content.size, Math.max(from, to) + 1)
    doc.nodesBetween(a, b, (node, pos) => {
      if (node.type.name !== typeName) return true
      seen.set(pos, node)
      return false
    })
  }
  return [...seen].sort((x, y) => x[0] - y[0]).map(([pos, node]) => ({ pos, node }))
}
