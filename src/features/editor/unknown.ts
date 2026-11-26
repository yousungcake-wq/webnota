import type { Schema } from '@tiptap/pm/model'
import * as Y from 'yjs'

/**
 * Node and mark types in a page's Y.XmlFragment that this build's schema does not know
 * (ED-B23) — written by a newer app version. y-tiptap would delete them while rendering
 * unless `onInvalidContent` is set; the editor then keeps them and opens the page
 * read-only. This lists them for the notice.
 */
export function findUnknownContent(fragment: Y.XmlFragment, schema: Schema) {
  const nodes = new Set<string>()
  const marks = new Set<string>()
  const walk = (type: Y.XmlElement | Y.XmlFragment) => {
    for (const child of type.toArray()) {
      if (child instanceof Y.XmlElement) {
        if (!schema.nodes[child.nodeName]) nodes.add(child.nodeName)
        walk(child)
      } else if (child instanceof Y.XmlText) {
        for (const d of child.toDelta() as { attributes?: Record<string, unknown> }[])
          for (const name of Object.keys(d.attributes ?? {}))
            if (!schema.marks[name] && name !== 'ychange') marks.add(name)
      }
    }
  }
  walk(fragment)
  return { nodes: [...nodes], marks: [...marks] }
}
