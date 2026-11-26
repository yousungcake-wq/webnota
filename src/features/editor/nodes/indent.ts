import { Extension } from '@tiptap/core'
import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model'
import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { liftTarget } from '@tiptap/pm/transform'
import type { EditorView } from '@tiptap/pm/view'
import { openToggle } from './toggle'

/**
 * Indent beyond lists (ED-F09), after the list keymaps (priority 50):
 * Tab on a block right after a toggle moves it into the toggle; right after a list, it
 * becomes a child of the list's last item. Shift+Tab moves a block out of a toggle, or
 * lifts a non-first child out of a list item. Tab never leaves the editor.
 */

const LISTS = ['bulletList', 'orderedList', 'taskList']

/** The text block at the cursor and where it sits. */
function blockAt($from: ResolvedPos) {
  const d = $from.depth
  if (d < 1) return null
  return { node: $from.node(d), from: $from.before(d), container: $from.node(d - 1), index: $from.index(d - 1), d }
}

/** Moves the block [from, from+size) to `target` (before it), keeping the caret offset. */
function moveTo(tr: Transaction, node: PMNode, from: number, target: number, caret: number) {
  tr.delete(from, from + node.nodeSize).insert(target, node)
  tr.setSelection(TextSelection.near(tr.doc.resolve(target + 1 + caret)))
  return tr
}

export function indentBlock(state: EditorState, view?: EditorView): Transaction | null {
  const b = blockAt(state.selection.$from)
  if (!b || b.index === 0 || b.container.type.name === 'listItem' || b.container.type.name === 'taskItem') return null
  const prev = b.container.child(b.index - 1)
  const prevPos = b.from - prev.nodeSize
  const caret = state.selection.from - b.from - 1
  if (prev.type.name === 'toggle') {
    if (view) openToggle(view, prevPos)
    return moveTo(state.tr, b.node, b.from, prevPos + prev.nodeSize - 2, caret) // end of toggleContent
  }
  if (LISTS.includes(prev.type.name) && prev.lastChild) {
    return moveTo(state.tr, b.node, b.from, prevPos + prev.nodeSize - 2, caret) // end of the last item
  }
  return null
}

export function outdentBlock(state: EditorState): Transaction | null {
  const $from = state.selection.$from
  const b = blockAt($from)
  if (!b) return null
  const caret = state.selection.from - b.from - 1
  if (b.container.type.name === 'toggleContent' && b.d >= 3) {
    const togglePos = $from.before(b.d - 2)
    const toggle = $from.node(b.d - 2)
    const after = togglePos + toggle.nodeSize
    const tr = state.tr.insert(after, b.node)
    // toggleContent needs a block: leave an empty paragraph if this was the only one
    if (b.container.childCount === 1)
      tr.replaceWith(b.from, b.from + b.node.nodeSize, state.schema.nodes.paragraph!.create())
    else tr.delete(b.from, b.from + b.node.nodeSize)
    const moved = tr.mapping.map(after) - b.node.nodeSize
    return tr.setSelection(TextSelection.near(tr.doc.resolve(moved + 1 + caret)))
  }
  if ((b.container.type.name === 'listItem' || b.container.type.name === 'taskItem') && b.index > 0) {
    const range = $from.blockRange()
    const target = range && liftTarget(range)
    return range && target != null ? state.tr.lift(range, target) : null
  }
  return null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indentBlocks: {
      /** Into the toggle / list item before this block (not for list items: use sinkListItem). */
      indentBlock: () => ReturnType
      /** Out of a toggle, or a non-first child out of its list item. */
      outdentBlock: () => ReturnType
    }
  }
}

export const IndentBlocks = Extension.create({
  name: 'indentBlocks',
  priority: 50,
  addCommands() {
    return {
      indentBlock:
        () =>
        ({ state, dispatch, view }) => {
          const tr = indentBlock(state, dispatch ? view : undefined)
          if (tr && dispatch) dispatch(tr.scrollIntoView())
          return !!tr
        },
      outdentBlock:
        () =>
        ({ state, dispatch }) => {
          const tr = outdentBlock(state)
          if (tr && dispatch) dispatch(tr.scrollIntoView())
          return !!tr
        },
    }
  },
  addKeyboardShortcuts() {
    const run = (make: (s: EditorState) => Transaction | null) => {
      const { state, view } = this.editor
      if (state.selection.$from.parent.type.spec.code) return false
      const tr = make(state)
      if (tr) view.dispatch(tr.scrollIntoView())
      return true // keep focus in the editor either way
    }
    return {
      Tab: () => run((s) => indentBlock(s, this.editor.view)),
      'Shift-Tab': () => run(outdentBlock),
    }
  },
})
