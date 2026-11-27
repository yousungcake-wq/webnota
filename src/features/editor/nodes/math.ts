import { mergeAttributes, Node } from '@tiptap/core'

/**
 * Math (schema v17): `mathBlock` (ED-B15, display) and `inlineMath` (ED-I06). Both are
 * atoms holding LaTeX in `latex`; rendering (KaTeX, lazy) and editing live in
 * `mathNodes.ts` / `MathEditor.tsx`. Without the app the source shows as `$…$` / `$$…$$`.
 */
export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-latex') ?? '',
        renderHTML: (a) => ({ 'data-latex': a.latex as string }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-math-block]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes({ 'data-math-block': '', class: 'math-block' }, HTMLAttributes),
      `$$${node.attrs.latex as string}$$`,
    ]
  },
})

export const InlineMath = Node.create({
  name: 'inlineMath',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-latex') ?? '',
        renderHTML: (a) => ({ 'data-latex': a.latex as string }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-inline-math]' }]
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes({ 'data-inline-math': '', class: 'inline-math' }, HTMLAttributes),
      `$${node.attrs.latex as string}$`,
    ]
  },
  renderText: ({ node }) => `$${node.attrs.latex as string}$`,
})

/**
 * `$x^2$` typed as text: an inline formula. The content must not start or end with a
 * space, so prices ("$5 and $10") stay text.
 */
export const INLINE_MATH_INPUT = /(?:^|[\s(])\$([^\s$](?:[^$\n]*[^\s$\\])?)\$$/
