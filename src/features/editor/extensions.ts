import { Extension, type Extensions } from '@tiptap/core'
import Collaboration from '@tiptap/extension-collaboration'
import { Placeholder } from '@tiptap/extensions'
import { Selection, type EditorState, type Transaction } from '@tiptap/pm/state'
import type * as Y from 'yjs'
import { SlashCommand } from './slash'
import { schemaExtensions } from './schema'
import { MentionSuggest, MentionWithView } from './mentionSuggest'
import { EmojiSuggest } from './emojiSuggest'
import { SubPageWithView } from './SubPageBlock'
import { OutlineWithView } from './OutlineBlock'
import { ImageWithView } from './ImageBlock'
import { FileWithView } from './FileBlock'
import { EmbedWithView, VideoWithView } from './EmbedBlock'
import { FileDrop } from './fileDrop'
import { BlockFlash } from './blockFlash'
import { BlockSelection } from './blockSelection'
import { PasteRules } from './pasteRules'
import { FindReplace } from './findReplace'
import { UndoGroups } from './undoGroups'
import { IndentBlocks } from './nodes/indent'
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
  /** The page being edited: parent of sub-pages created from the editor (ED-B19). */
  pageId?: string
}

export function editorExtensions(doc: Y.Doc, opts: EditorOptions = {}): Extensions {
  // nodes that get a React view here; schemaExtensions() stays React-free
  const withViews: Record<string, Extensions[number]> = {
    mention: MentionWithView,
    subPage: SubPageWithView.configure({ pageId: opts.pageId ?? null }),
    outline: OutlineWithView,
    image: ImageWithView,
    file: FileWithView,
    video: VideoWithView,
    embed: EmbedWithView,
  }
  return [
    ...schemaExtensions().map((e) => withViews[e.name] ?? e),
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
    BlockFlash,
    PasteRules,
    FileDrop,
    FindReplace,
    UndoGroups,
    IndentBlocks,
    EmojiSuggest,
    BlockMove,
    BlockSelection, // priority 50: menus (slash, mentions) handle Esc / arrows first
  ]
}

export { docSchema, schemaExtensions } from './schema'
