import { InputRule, mergeAttributes, Node } from '@tiptap/core'
import { Fragment, type Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { t } from '@/core/i18n'

/**
 * Toggle list / toggle heading (ED-B06, ED-B07):
 *   toggle(level, toggleId) > toggleSummary (inline*) + toggleContent (block+)
 * Node names are stored data — never rename them (spec/02 §6). Whether a toggle is open
 * is per device (localStorage, keyed by `toggleId`), not document data.
 */

const OPEN_KEY = 'webnota:toggles-closed'
const closed = new Set<string>(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(OPEN_KEY) || '[]') as string[]
    } catch {
      return []
    }
  })(),
)
function setOpen(id: string, open: boolean) {
  if (open) closed.delete(id)
  else closed.add(id)
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify([...closed].slice(-2000)))
  } catch {
    /* ignore */
  }
}
/** Opens a toggle (expanded state is per device) and its DOM right away. */
export function openToggle(view: EditorView, pos: number) {
  const node = view.state.doc.nodeAt(pos)
  const tid = node?.attrs.toggleId as string | null | undefined
  if (!tid || !closed.has(tid)) return
  setOpen(tid, true)
  const dom = view.nodeDOM(pos)
  if (dom instanceof HTMLElement) dom.classList.add('is-open')
}

const newToggleId = () => Math.random().toString(36).slice(2, 12)

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggle: {
      /** Wraps the current text block into a toggle (level = toggle heading). */
      setToggle: (level?: number | null) => ReturnType
    }
  }
}

export const ToggleSummary = Node.create({
  name: 'toggleSummary',
  content: 'inline*',
  defining: true,
  selectable: false,
  parseHTML: () => [{ tag: 'div[data-type="toggleSummary"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'toggleSummary' }), 0],
})

export const ToggleContent = Node.create({
  name: 'toggleContent',
  content: 'block+',
  defining: true,
  selectable: false,
  parseHTML: () => [{ tag: 'div[data-type="toggleContent"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'toggleContent' }), 0],
})

export const Toggle = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'toggleSummary toggleContent',
  defining: true,
  addAttributes() {
    return {
      level: { default: null, parseHTML: (el) => Number(el.getAttribute('data-level')) || null },
      toggleId: { default: null, parseHTML: (el) => el.getAttribute('data-toggle-id') },
    }
  },
  parseHTML: () => [{ tag: 'div[data-type="toggle"]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'div',
    mergeAttributes(HTMLAttributes, {
      'data-type': 'toggle',
      'data-level': node.attrs.level ?? undefined,
      'data-toggle-id': node.attrs.toggleId ?? undefined,
    }),
    0,
  ],

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current = node
      const dom = document.createElement('div')
      dom.className = 'toggle'
      dom.dataset.type = 'toggle'
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'toggle-arrow'
      button.contentEditable = 'false'
      button.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>'
      const body = document.createElement('div')
      body.className = 'toggle-body'
      dom.append(button, body)

      const id = () => current.attrs.toggleId as string | null
      const apply = () => {
        const open = !id() || !closed.has(id()!)
        dom.classList.toggle('is-open', open)
        button.setAttribute('aria-expanded', String(open))
        button.setAttribute('aria-label', open ? t('tree.collapse') : t('tree.expand'))
        if (current.attrs.level) dom.dataset.level = String(current.attrs.level)
        else delete dom.dataset.level
      }
      button.addEventListener('mousedown', (e) => e.preventDefault())
      button.addEventListener('click', () => {
        if (!id()) return
        setOpen(id()!, closed.has(id()!))
        apply()
        // Collapsing with the caret inside the content: move it to the summary.
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (pos !== undefined && !dom.classList.contains('is-open') && editor.isEditable) {
          const { from } = editor.state.selection
          const summaryEnd = pos + 1 + current.child(0).nodeSize - 1
          if (from > summaryEnd) editor.commands.setTextSelection(summaryEnd)
        }
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
        ignoreMutation: (m) => m.target === button || button.contains(m.target as globalThis.Node),
      }
    }
  },

  addCommands() {
    return {
      setToggle:
        (level = null) =>
        ({ state, dispatch }) => {
          const { $from } = state.selection
          const block = $from.parent
          if (!block.isTextblock || $from.depth < 1) return false
          const { schema } = state
          const start = $from.before()
          const end = $from.after()
          const toggle = schema.nodes.toggle!.create({ level, toggleId: newToggleId() }, [
            schema.nodes.toggleSummary!.create(null, block.content),
            schema.nodes.toggleContent!.create(null, schema.nodes.paragraph!.create()),
          ])
          if (dispatch) {
            const tr = state.tr.replaceWith(start, end, toggle)
            tr.setSelection(TextSelection.create(tr.doc, start + 2 + block.content.size))
            dispatch(tr.scrollIntoView())
          }
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Enter at the end of a summary: into the content (open the toggle first).
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection
        if (!empty || $from.parent.type.name !== 'toggleSummary' || $from.parentOffset !== $from.parent.content.size)
          return false
        const toggle = $from.node(-1)
        const togglePos = $from.before(-1)
        const tid = toggle.attrs.toggleId as string | null
        if (tid && closed.has(tid)) {
          setOpen(tid, true)
          const dom = editor.view.nodeDOM(togglePos)
          if (dom instanceof HTMLElement) dom.classList.add('is-open')
        }
        const contentStart = togglePos + 1 + toggle.child(0).nodeSize + 1
        return editor.commands.setTextSelection(contentStart + 1)
      },
      // Backspace at the start of a summary: turn the toggle back into a paragraph,
      // keeping its content as following blocks.
      Backspace: ({ editor }) => {
        const { $from, empty } = editor.state.selection
        if (!empty || $from.parent.type.name !== 'toggleSummary' || $from.parentOffset !== 0) return false
        const toggle = $from.node(-1)
        const pos = $from.before(-1)
        const { schema, tr } = editor.state
        const blocks: PMNode[] = [schema.nodes.paragraph!.create(null, $from.parent.content)]
        toggle.child(1).forEach((child) => {
          if (!(child.type.name === 'paragraph' && child.content.size === 0)) blocks.push(child)
        })
        tr.replaceWith(pos, pos + toggle.nodeSize, Fragment.from(blocks))
        tr.setSelection(TextSelection.create(tr.doc, pos + 1))
        editor.view.dispatch(tr)
        return true
      },
    }
  },

  addInputRules() {
    return [
      new InputRule({
        find: /^>\s$/,
        handler: ({ state, range, chain }) => {
          const { $from } = state.selection
          if ($from.parent.type.name !== 'paragraph' || $from.depth > 1) return
          chain().deleteRange(range).setToggle(null).run()
        },
      }),
    ]
  },
})
