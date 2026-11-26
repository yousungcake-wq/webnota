import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * Multi-block selection (ED-F04). The selection is a real TextSelection from the start
 * of the first block to the end of the last one, so copy / cut / delete work natively;
 * the plugin adds "block mode": whole blocks are highlighted and the arrows move by
 * block. Any other selection change leaves block mode.
 */

export interface BlockRange {
  anchor: number // top-level block indexes
  head: number
}

export const blockSelectionKey = new PluginKey<BlockRange | null>('blockSelection')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockSelection: {
      /** Selects top-level blocks anchor…head (indexes) in block mode. */
      selectBlocks: (anchor: number, head: number) => ReturnType
      /** Block mode on the top-level block holding the cursor. */
      selectCurrentBlock: () => ReturnType
      exitBlockSelection: () => ReturnType
    }
  }
}

/** Start position of each top-level block. */
function starts(doc: PMNode): number[] {
  const out: number[] = []
  doc.forEach((_, offset) => out.push(offset))
  return out
}

/** Document range [from, to) covering top-level blocks a…b (either order). */
export function blockRangePositions(doc: PMNode, range: BlockRange) {
  const s = starts(doc)
  const a = Math.max(0, Math.min(range.anchor, range.head))
  const b = Math.min(s.length - 1, Math.max(range.anchor, range.head))
  return { from: s[a]!, to: s[b]! + doc.child(b).nodeSize, first: a, last: b }
}

/** Start positions of the selected blocks. */
export function selectedBlockPositions(state: EditorState): number[] {
  const range = blockSelectionKey.getState(state)
  if (!range) return []
  const s = starts(state.doc)
  const { first, last } = blockRangePositions(state.doc, range)
  return s.slice(first, last + 1)
}

export const blockRangeOf = (state: EditorState) => blockSelectionKey.getState(state) ?? null

function select(tr: Transaction, range: BlockRange): Transaction {
  const { from, to } = blockRangePositions(tr.doc, range)
  // TextSelection.between finds the nearest text positions inside the outer blocks
  const sel = TextSelection.between(tr.doc.resolve(from), tr.doc.resolve(to))
  return tr.setSelection(sel).setMeta(blockSelectionKey, range)
}

const indexAt = (doc: PMNode, pos: number) => doc.resolve(Math.min(pos, doc.content.size)).index(0)

export const BlockSelection = Extension.create({
  name: 'blockSelection',
  // below the default (100): suggestion menus and list keymaps see Esc / Enter / arrows first
  priority: 50,
  addCommands() {
    return {
      selectBlocks:
        (anchor, head) =>
        ({ tr, dispatch }) => {
          if (tr.doc.childCount === 0) return false
          if (dispatch) select(tr, { anchor, head }).scrollIntoView()
          return true
        },
      selectCurrentBlock:
        () =>
        ({ tr, state, dispatch }) => {
          const i = indexAt(state.doc, state.selection.from)
          if (dispatch) select(tr, { anchor: i, head: indexAt(state.doc, state.selection.to) })
          return true
        },
      exitBlockSelection:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(blockSelectionKey, null)
          return true
        },
    }
  },
  addKeyboardShortcuts() {
    const editor = this.editor
    const range = () => blockSelectionKey.getState(editor.state)
    const last = () => editor.state.doc.childCount - 1
    const move = (delta: number, extend: boolean) => {
      const r = range()
      if (!r) return false
      const head = Math.max(0, Math.min(last(), r.head + delta))
      return editor.commands.selectBlocks(extend ? r.anchor : head, head)
    }
    const leave = (toEnd: boolean) => {
      const r = range()
      if (!r) return false
      const { from, to } = blockRangePositions(editor.state.doc, { anchor: r.head, head: r.head })
      const pos = toEnd ? to - 1 : from + 1
      editor.chain().exitBlockSelection().setTextSelection(Math.max(1, pos)).run()
      return true
    }
    return {
      Escape: () => (range() ? leave(true) : editor.commands.selectCurrentBlock()),
      Enter: () => leave(true),
      ArrowUp: () => move(-1, false),
      ArrowDown: () => move(1, false),
      'Shift-ArrowUp': () => (range() ? move(-1, true) : false),
      'Shift-ArrowDown': () => (range() ? move(1, true) : false),
      'Mod-a': () => (range() ? editor.commands.selectBlocks(0, last()) : false),
      Backspace: () => (range() ? editor.commands.deleteSelection() : false),
      Delete: () => (range() ? editor.commands.deleteSelection() : false),
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<BlockRange | null>({
        key: blockSelectionKey,
        state: {
          init: () => null,
          apply: (tr, value) => {
            const meta = tr.getMeta(blockSelectionKey) as BlockRange | null | undefined
            if (meta !== undefined) return meta
            // typing, deleting, or moving the cursor elsewhere leaves block mode
            return value && (tr.docChanged || tr.selectionSet) ? null : value
          },
        },
        props: {
          attributes: (state): Record<string, string> =>
            blockSelectionKey.getState(state) ? { class: 'block-mode' } : {},
          decorations(state) {
            const r = blockSelectionKey.getState(state)
            if (!r) return null
            const { first, last } = blockRangePositions(state.doc, r)
            const decos: Decoration[] = []
            let i = 0
            state.doc.forEach((node, offset) => {
              if (i >= first && i <= last)
                decos.push(Decoration.node(offset, offset + node.nodeSize, { class: 'block-selected' }))
              i++
            })
            return DecorationSet.create(state.doc, decos)
          },
          handleDOMEvents: {
            // Shift+click extends the block selection to the clicked block
            mousedown: (view, event) => {
              const r = blockSelectionKey.getState(view.state)
              if (!r || !event.shiftKey) return false
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
              if (!pos) return false
              event.preventDefault()
              view.dispatch(select(view.state.tr, { anchor: r.anchor, head: indexAt(view.state.doc, pos.pos) }))
              return true
            },
          },
        },
      }),
    ]
  },
})
