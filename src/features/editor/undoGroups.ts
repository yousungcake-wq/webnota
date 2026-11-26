import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { yUndoPluginKey } from '@tiptap/y-tiptap'

/**
 * Undo grouping (ED-F08). Yjs merges changes made within 500ms into one undo step;
 * a new paragraph, Tab, paste, cut, drop or a replace starts a new step, so undo
 * removes one paragraph / one paste rather than everything typed in a burst.
 */
function stop(state: EditorState) {
  const undo = yUndoPluginKey.getState(state) as { undoManager?: { stopCapturing: () => void } } | undefined
  undo?.undoManager?.stopCapturing()
}

export const UndoGroups = Extension.create({
  name: 'undoGroups',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('undoGroups'),
        props: {
          handleKeyDown: (view, event) => {
            if (event.key === 'Enter' || event.key === 'Tab') stop(view.state)
            return false
          },
          handlePaste: (view) => {
            stop(view.state)
            return false
          },
          handleDrop: (view) => {
            stop(view.state)
            return false
          },
        },
        // cut, and our own discrete edits (replace, menus) — before y-sync writes them
        appendTransaction: (trs, _old, state) => {
          if (trs.some((tr) => tr.getMeta('uiEvent') === 'cut' || tr.getMeta('wnUndoBoundary'))) stop(state)
          return null
        },
      }),
    ]
  },
})
