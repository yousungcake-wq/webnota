import { Extension, type Extensions } from '@tiptap/core'
import Collaboration from '@tiptap/extension-collaboration'
import { Placeholder } from '@tiptap/extensions'
import { Selection, type EditorState, type Transaction } from '@tiptap/pm/state'
import type * as Y from 'yjs'
import { SlashCommand } from './slash'
import { schemaExtensions } from './schema'
import { MentionSuggest, MentionWithView } from './mentionSuggest'
import { EmojiSuggest } from './emojiSuggest'
import { t } from '@/core/i18n'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockMove: {
      moveBlockUp: () => ReturnType
      moveBlockDown: () => ReturnType
    }
  }
}

/** Swaps the top-level block containing the cursor with its neighbour, keeping the cursor inside it. */
function moveBlock(dir: -1 | 1) {
  return ({ state, dispatch }: { state: EditorState; dispatch?: (tr: Transaction) => void }) => {
    const { $from } = state.selection
    if ($from.depth < 1) return false
    const index = $from.index(0)
    const target = index + dir
    if (target < 0 || target >= state.doc.childCount) return false
    const node = state.doc.child(index)
    const other = state.doc.child(target)
    const start = $from.before(1)
    const offset = state.selection.from - start
    if (dispatch) {
      const tr = state.tr
      let newStart: number
      if (dir === -1) {
        newStart = start - other.nodeSize
        tr.delete(start, start + node.nodeSize).insert(newStart, node)
      } else {
        tr.insert(start + node.nodeSize + other.nodeSize, node).delete(start, start + node.nodeSize)
        newStart = start + other.nodeSize
      }
      const pos = Math.min(newStart + offset, tr.doc.content.size)
      tr.setSelection(Selection.near(tr.doc.resolve(pos)))
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

export const BlockMove = Extension.create({
  name: 'blockMove',
  addCommands() {
    return {
      moveBlockUp: () => moveBlock(-1),
      moveBlockDown: () => moveBlock(1),
    }
  },
  addKeyboardShortcuts() {
    return {
      'Alt-Shift-ArrowUp': () => this.editor.commands.moveBlockUp(),
      'Alt-Shift-ArrowDown': () => this.editor.commands.moveBlockDown(),
    }
  },
})

export interface EditorOptions {
  /**
   * Called when the page holds content this schema does not know (ED-B23). Without it
   * y-tiptap deletes that content while rendering; with it the content is kept and the
   * binding stops writing to the doc (the page becomes read-only).
   */
  onInvalidContent?: (error: Error) => void
}

export function editorExtensions(doc: Y.Doc, opts: EditorOptions = {}): Extensions {
  return [
    // the mention node gets its React chip here; schemaExtensions() stays React-free
    ...schemaExtensions().map((e) => (e.name === 'mention' ? MentionWithView : e)),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') return t('editor.headingPlaceholder', { level: node.attrs.level as number })
        return t('editor.placeholder')
      },
      showOnlyCurrent: true,
    }),
    Collaboration.configure({
      document: doc,
      field: 'default',
      ySyncOptions: { onInvalidContent: opts.onInvalidContent ?? (() => {}) },
    }),
    SlashCommand,
    MentionSuggest,
    EmojiSuggest,
    BlockMove,
  ]
}

export { docSchema, schemaExtensions } from './schema'
