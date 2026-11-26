import { mergeAttributes, Node } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'

/** Table of contents (ED-B18): lists the page's headings; built when rendering, nothing stored. */
export const Outline = Node.create({
  name: 'outline',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  parseHTML() {
    return [{ tag: 'nav[data-outline]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['nav', mergeAttributes(HTMLAttributes, { 'data-outline': '', class: 'outline' })]
  },
})

export interface Heading {
  pos: number
  level: number
  text: string
}

/** Headings of the document in order (top-level and nested, e.g. inside toggles or columns). */
export function headingsOf(doc: PMNode): Heading[] {
  const out: Heading[] = []
  doc.descendants((n, pos) => {
    if (n.type.name === 'heading') {
      out.push({ pos, level: n.attrs.level as number, text: n.textContent })
      return false
    }
    return !n.isTextblock
  })
  return out
}
