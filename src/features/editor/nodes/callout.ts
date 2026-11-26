import { mergeAttributes, Node } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

/**
 * Callout (ED-B09): an emoji and a background color around blocks. Clicking the emoji
 * dispatches `wn-callout-icon` (detail: { pos, anchor }) for the editor to open the
 * picker. Node name and attrs are stored data (spec/02 §6).
 */
export const CALLOUT_COLORS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red']

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: () => ReturnType
      updateCallout: (pos: number, attrs: { icon?: string; color?: string }) => ReturnType
    }
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      icon: { default: '💡', parseHTML: (el) => el.getAttribute('data-icon') || '💡' },
      color: { default: 'default', parseHTML: (el) => el.getAttribute('data-color') || 'default' },
    }
  },
  parseHTML: () => [{ tag: 'div[data-type="callout"]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, {
      'data-type': 'callout',
      'data-icon': node.attrs.icon,
      'data-color': node.attrs.color,
    }),
    0,
  ],
  addNodeView() {
    return ({ node, getPos }) => {
      let current = node
      const dom = document.createElement('div')
      dom.className = 'callout'
      const icon = document.createElement('button')
      icon.type = 'button'
      icon.className = 'callout-icon'
      icon.contentEditable = 'false'
      const body = document.createElement('div')
      body.className = 'callout-body'
      dom.append(icon, body)
      const apply = () => {
        icon.textContent = current.attrs.icon as string
        dom.dataset.color = current.attrs.color as string
      }
      icon.addEventListener('mousedown', (e) => e.preventDefault())
      icon.addEventListener('click', () => {
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (pos === undefined) return
        dom.dispatchEvent(new CustomEvent('wn-callout-icon', { bubbles: true, detail: { pos, anchor: icon } }))
      })
      apply()
      return {
        dom,
        contentDOM: body,
        update: (n) => {
          if (n.type !== current.type) return false
          current = n
          apply()
          return true
        },
        ignoreMutation: (m) => m.target === icon || icon.contains(m.target as globalThis.Node),
      }
    }
  },
  addCommands() {
    return {
      setCallout:
        () =>
        ({ state, dispatch }) => {
          const { $from } = state.selection
          if (!$from.parent.isTextblock || $from.depth < 1) return false
          const start = $from.before()
          const end = $from.after()
          const para = state.schema.nodes.paragraph!.create(null, $from.parent.content)
          const callout = state.schema.nodes.callout!.create(null, para)
          if (dispatch) {
            const tr = state.tr.replaceWith(start, end, callout)
            tr.setSelection(TextSelection.create(tr.doc, start + 2 + para.content.size))
            dispatch(tr.scrollIntoView())
          }
          return true
        },
      updateCallout:
        (pos, attrs) =>
        ({ state, dispatch }) => {
          const node = state.doc.nodeAt(pos)
          if (node?.type.name !== 'callout') return false
          if (dispatch) dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }))
          return true
        },
    }
  },
})
