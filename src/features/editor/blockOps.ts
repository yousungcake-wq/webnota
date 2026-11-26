import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { MAX_COLUMNS, MIN_COLUMNS } from './nodes/columns'

/** Block menu operations (ED-F03) on the block at `pos`. Each returns a transaction or null. */

const withoutIds = (node: PMNode): PMNode => {
  const copy = (n: PMNode): PMNode => {
    const attrs = 'blockId' in n.attrs ? { ...n.attrs, blockId: null } : n.attrs
    const children: PMNode[] = []
    n.forEach((c) => children.push(copy(c)))
    return n.isText ? n : n.type.create(attrs, children, n.marks)
  }
  return copy(node)
}

export function duplicateBlock(state: EditorState, pos: number): Transaction | null {
  const node = state.doc.nodeAt(pos)
  if (!node) return null
  return state.tr.insert(pos + node.nodeSize, withoutIds(node))
}

export function deleteBlock(state: EditorState, pos: number): Transaction | null {
  const node = state.doc.nodeAt(pos)
  if (!node) return null
  return state.tr.delete(pos, pos + node.nodeSize)
}

/** Whether `attr` can be set on the block, or on its items (a list's colors go on its items). */
export function supportsAttr(node: PMNode, attr: string): boolean {
  if (attr in node.attrs) return true
  let items = false
  node.forEach((c) => (items ||= attr in c.attrs))
  return items
}

export function setBlockAttr(state: EditorState, pos: number, attr: string, value: unknown): Transaction | null {
  const node = state.doc.nodeAt(pos)
  if (!node) return null
  const tr = state.tr
  if (attr in node.attrs) return tr.setNodeAttribute(pos, attr, value)
  let changed = false
  node.forEach((child, offset) => {
    if (attr in child.attrs) {
      tr.setNodeAttribute(pos + 1 + offset, attr, value)
      changed = true
    }
  })
  return changed ? tr : null
}

/** Gives the block an id for block links (keeps an existing one). */
export function ensureBlockId(
  state: EditorState,
  pos: number,
  newId: () => string,
): { id: string; tr: Transaction | null } | null {
  const node = state.doc.nodeAt(pos)
  if (!node || !('blockId' in node.attrs)) return null
  const existing = node.attrs.blockId as string | null
  if (existing) return { id: existing, tr: null }
  const id = newId()
  return { id, tr: state.tr.setNodeAttribute(pos, 'blockId', id) }
}

/** Position of the first block with this id, or -1. */
export function findBlock(doc: PMNode, id: string): number {
  let found = -1
  doc.descendants((n, pos) => {
    if (found >= 0) return false
    if (n.attrs.blockId === id) found = pos
    return found < 0 && !n.isTextblock
  })
  return found
}

export function addColumn(state: EditorState, pos: number): Transaction | null {
  const node = state.doc.nodeAt(pos)
  if (node?.type.name !== 'columns' || node.childCount >= MAX_COLUMNS) return null
  const { column, paragraph } = state.schema.nodes
  return state.tr.insert(pos + node.nodeSize - 1, column!.create(null, paragraph!.create()))
}

/** Moves the last column's content to the end of the previous one and removes it (no content lost). */
export function mergeLastColumn(state: EditorState, pos: number): Transaction | null {
  const node = state.doc.nodeAt(pos)
  if (node?.type.name !== 'columns' || node.childCount <= MIN_COLUMNS) return null
  const last = node.lastChild!
  const lastPos = pos + node.nodeSize - 1 - last.nodeSize
  const prevEnd = lastPos - 1 // inside the previous column, before its closing token
  return state.tr.delete(lastPos, lastPos + last.nodeSize).insert(prevEnd, last.content)
}

/** Copies blocks [from, to) right after `to` (block ids dropped). */
export function duplicateRange(state: EditorState, from: number, to: number): Transaction {
  const nodes: PMNode[] = []
  state.doc.nodesBetween(from, to, (n, pos) => {
    if (pos >= from && pos + n.nodeSize <= to) nodes.push(withoutIds(n))
    return false
  })
  return state.tr.insert(to, nodes)
}

/** Sets an attribute on several blocks (or their items); null when none support it. */
export function setRangeAttr(
  state: EditorState,
  positions: number[],
  attr: string,
  value: unknown,
): Transaction | null {
  const tr = state.tr
  let changed = false
  for (const pos of positions) {
    const node = tr.doc.nodeAt(pos)
    if (!node) continue
    if (attr in node.attrs) {
      tr.setNodeAttribute(pos, attr, value)
      changed = true
    } else
      node.forEach((child, offset) => {
        if (attr in child.attrs) {
          tr.setNodeAttribute(pos + 1 + offset, attr, value)
          changed = true
        }
      })
  }
  return changed ? tr : null
}
