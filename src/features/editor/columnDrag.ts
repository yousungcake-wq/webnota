import { Extension } from '@tiptap/core'
import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { MAX_COLUMNS } from './nodes/columns'

/**
 * Columns behave like blocks (user feedback 3, Notion style):
 * - blocks inside a column have their own handles (nested drag handle, see Editor.tsx)
 *   and can be dragged into another column or out below the columns;
 * - dropping a block on the left/right edge of another block puts them side by side
 *   (a new `columns`, or a new column next to the target's column);
 * - a column emptied by a drag disappears, and columns left with one column unwrap.
 */

const SIDE_ZONE = 0.18 // share of the block width at each edge that means "beside"
const key = new PluginKey('columnDrag')

/** Depth of the nearest `column` ancestor of $pos, or -1. */
function columnDepth($pos: ResolvedPos): number {
  for (let d = $pos.depth; d > 0; d--) if ($pos.node(d).type.name === 'column') return d
  return -1
}

const isEmptyColumn = (col: PMNode) =>
  col.childCount === 1 && col.firstChild!.type.name === 'paragraph' && col.firstChild!.content.size === 0

/** Removes the column at `pos` if a drag emptied it; unwraps its `columns` if one column is left. */
function cleanupColumn(tr: Transaction, pos: number) {
  const col = tr.doc.nodeAt(pos)
  if (!col || col.type.name !== 'column' || !isEmptyColumn(col)) return
  const $pos = tr.doc.resolve(pos)
  const parent = $pos.parent
  const parentPos = $pos.before()
  if (parent.type.name !== 'columns') return
  if (parent.childCount > 2) {
    tr.delete(pos, pos + col.nodeSize)
    return
  }
  // two columns, one empty: the other column's blocks replace the columns block
  const other = parent.firstChild === col ? parent.lastChild! : parent.firstChild!
  tr.replaceWith(parentPos, parentPos + parent.nodeSize, other.content)
}

/** The block under the pointer that a side drop would sit next to (top level or in a column). */
function sideTarget(view: EditorView, x: number, y: number) {
  const hit = view.posAtCoords({ left: x, top: y })
  if (!hit) return null
  const doc = view.state.doc
  // the block's position: from a text position inside it, or (atoms like images) `inside`
  let pos = -1
  const $pos = doc.resolve(hit.pos)
  const cd = columnDepth($pos)
  const depth = cd >= 0 ? cd + 1 : 1
  if ($pos.depth >= depth) pos = $pos.before(depth)
  else if (hit.inside >= 0) {
    const $in = doc.resolve(hit.inside)
    if ($in.depth === 0 || $in.parent.type.name === 'column') pos = hit.inside
  }
  if (pos < 0) return null
  const $block = doc.resolve(pos)
  const inColumn = $block.parent.type.name === 'column'
  const node = doc.nodeAt(pos)
  if (!node || node.type.name === 'columns' || node.type.name === 'column') return null
  const dom = view.nodeDOM(pos) as HTMLElement | null
  if (!dom?.getBoundingClientRect) return null
  const r = dom.getBoundingClientRect()
  const side = x < r.left + r.width * SIDE_ZONE ? 'left' : x > r.right - r.width * SIDE_ZONE ? 'right' : null
  if (!side) return null
  return { pos, node, side, inColumn, columnPos: inColumn ? $block.before() : -1, rect: r } as const
}

let pendingSource: number | null = null
let indicator: HTMLElement | null = null
function showIndicator(rect: DOMRect | null, side: 'left' | 'right') {
  if (!rect) {
    indicator?.remove()
    indicator = null
    return
  }
  if (!indicator) {
    indicator = document.createElement('div')
    indicator.className = 'column-drop-indicator'
    document.body.append(indicator)
  }
  indicator.style.top = `${rect.top + window.scrollY}px`
  indicator.style.height = `${rect.height}px`
  indicator.style.left = `${(side === 'left' ? rect.left - 6 : rect.right + 4) + window.scrollX}px`
}

/** Source column of the dragged block (recorded when the drag starts). */
function sourceColumn(state: EditorState): number | null {
  const cd = columnDepth(state.selection.$from)
  return cd >= 0 ? state.selection.$from.before(cd) : null
}

export const ColumnDrag = Extension.create({
  name: 'columnDrag',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        // a column emptied by a normal drop disappears (and lone columns unwrap)
        appendTransaction(trs, _old, state) {
          if (pendingSource === null || !trs.some((t) => t.getMeta('uiEvent') === 'drop')) return null
          let src = pendingSource
          pendingSource = null
          for (const t of trs) src = t.mapping.map(src)
          const tr = state.tr
          cleanupColumn(tr, src)
          return tr.docChanged ? tr : null
        },
        props: {
          handleDOMEvents: {
            dragover: (view, e) => {
              if (!view.dragging) return false
              const t = sideTarget(view, e.clientX, e.clientY)
              showIndicator(t?.rect ?? null, t?.side ?? 'left')
              return false
            },
            dragleave: () => {
              showIndicator(null, 'left')
              return false
            },
            dragend: () => {
              showIndicator(null, 'left')
              return false
            },
          },
          handleDrop(view, e) {
            showIndicator(null, 'left')
            const dragging = view.dragging
            if (!dragging?.move) return false
            const t = sideTarget(view, e.clientX, e.clientY)
            if (!t) {
              // a normal drop: ProseMirror moves the block; clean up its old column afterwards
              pendingSource = sourceColumn(view.state)
              return false
            }
            const { state } = view
            const { from, to } = state.selection
            if (t.pos >= from && t.pos < to) return false // onto itself
            const slice = state.doc.slice(from, to)
            if (!slice.content.childCount) return false
            const schema = state.schema
            const columnType = schema.nodes.column!
            const columnsType = schema.nodes.columns!
            const tr = state.tr
            const src = sourceColumn(state)
            tr.delete(from, to)
            const map = (p: number) => tr.mapping.map(p)
            const dragged = columnType.create(null, slice.content)
            if (t.inColumn) {
              const colPos = map(t.columnPos)
              const col = tr.doc.nodeAt(colPos)
              const parent = tr.doc.resolve(colPos).parent
              if (!col || parent.childCount >= MAX_COLUMNS) return false
              tr.insert(t.side === 'left' ? colPos : colPos + col.nodeSize, dragged)
            } else {
              const pos = map(t.pos)
              const target = tr.doc.nodeAt(pos)
              if (!target) return false
              const pair = [columnType.create(null, target), dragged]
              if (t.side === 'left') pair.reverse()
              tr.replaceWith(pos, pos + target.nodeSize, columnsType.create(null, pair))
            }
            if (src !== null) cleanupColumn(tr, map(src))
            view.dispatch(tr.scrollIntoView())
            e.preventDefault()
            return true
          },
        },
      }),
    ]
  },
})
