import { mergeAttributes, Node, type JSONContent } from '@tiptap/core'

/**
 * Columns (ED-B17): `columns` holds 2–5 `column`s; each column's `width` is its share
 * (flex-grow, null = 1). Desktop: drag the gap between two columns to change their
 * ratio. Phones stack the columns.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      insertColumns: (count: number) => ReturnType
    }
  }
}

export const MIN_COLUMNS = 2
export const MAX_COLUMNS = 5
/** Smallest share a column can be dragged to, relative to the pair being resized. */
const MIN_SHARE = 0.15

export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  addAttributes() {
    return {
      width: {
        default: null,
        parseHTML: (el) => {
          const v = Number(el.getAttribute('data-width'))
          return v > 0 ? v : null
        },
        renderHTML: (a) => (a.width ? { 'data-width': String(a.width) } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-column]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-column': '',
        class: 'column',
        style: `flex-grow: ${node.attrs.width ?? 1}`,
      }),
      0,
    ]
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node
      const dom = document.createElement('div')
      dom.className = 'column'
      dom.dataset.column = ''
      const content = document.createElement('div')
      content.className = 'column-content'
      const handle = document.createElement('div')
      handle.className = 'column-resize'
      handle.contentEditable = 'false'
      dom.append(content, handle)
      const apply = () => {
        dom.style.flexGrow = String(current.attrs.width ?? 1)
      }
      apply()

      handle.addEventListener('pointerdown', (e) => {
        const next = dom.nextElementSibling as HTMLElement | null
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (!next || pos === undefined || !editor.isEditable) return
        e.preventDefault()
        handle.setPointerCapture(e.pointerId)
        const startX = e.clientX
        const a = dom.getBoundingClientRect().width
        const b = next.getBoundingClientRect().width
        const growA = Number(dom.style.flexGrow) || 1
        const growB = Number(next.style.flexGrow) || 1
        const total = growA + growB
        let share = growA / total
        const move = (ev: PointerEvent) => {
          share = Math.min(1 - MIN_SHARE, Math.max(MIN_SHARE, (a + ev.clientX - startX) / (a + b)))
          dom.style.flexGrow = String(share * total)
          next.style.flexGrow = String((1 - share) * total)
        }
        const up = () => {
          handle.removeEventListener('pointermove', move)
          handle.removeEventListener('pointerup', up)
          handle.removeEventListener('pointercancel', up)
          const round = (v: number) => Math.round(v * 100) / 100
          const { state } = editor
          const nextPos = pos + current.nodeSize
          const nextNode = state.doc.nodeAt(nextPos)
          if (nextNode?.type.name !== 'column') return
          editor.view.dispatch(
            state.tr
              .setNodeAttribute(pos, 'width', round(share * total))
              .setNodeAttribute(nextPos, 'width', round((1 - share) * total)),
          )
        }
        handle.addEventListener('pointermove', move)
        handle.addEventListener('pointerup', up)
        handle.addEventListener('pointercancel', up)
      })

      return {
        dom,
        contentDOM: content,
        update: (n) => {
          if (n.type !== current.type) return false
          current = n
          apply()
          return true
        },
        ignoreMutation: (m) => m.target === handle || m.target === dom || (m.type === 'attributes' && m.target === dom),
        stopEvent: (e) => e.target === handle,
      }
    }
  },
})

export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: `column{${MIN_COLUMNS},${MAX_COLUMNS}}`,
  isolating: true,
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-columns]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-columns': '', class: 'columns' }), 0]
  },
  addCommands() {
    return {
      insertColumns:
        (count) =>
        ({ commands }) => {
          const n = Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, count))
          const content: JSONContent = {
            type: 'columns',
            content: Array.from({ length: n }, () => ({ type: 'column', content: [{ type: 'paragraph' }] })),
          }
          return commands.insertContent(content)
        },
    }
  },
})
