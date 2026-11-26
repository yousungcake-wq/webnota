import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { findBlock } from './blockOps'

const key = new PluginKey<string | null>('blockFlash')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockFlash: {
      /** Highlights the block with this id (null clears it). */
      flashBlock: (blockId: string | null) => ReturnType
    }
  }
}

/**
 * Block link highlight (ED-F15) as a node decoration found by block id on every render,
 * so it survives y-sync replacing the document's DOM.
 */
export const BlockFlash = Extension.create({
  name: 'blockFlash',
  addCommands() {
    return {
      flashBlock:
        (blockId) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(key, blockId)
          return true
        },
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<string | null>({
        key,
        state: {
          init: () => null,
          apply: (tr, value) => {
            const meta = tr.getMeta(key) as string | null | undefined
            return meta === undefined ? value : meta
          },
        },
        props: {
          decorations(state) {
            const id = key.getState(state)
            if (!id) return null
            const pos = findBlock(state.doc, id)
            const node = pos >= 0 ? state.doc.nodeAt(pos) : null
            if (!node) return null
            return DecorationSet.create(state.doc, [
              Decoration.node(pos, pos + node.nodeSize, { class: 'block-flash' }),
            ])
          },
        },
      }),
    ]
  },
})
