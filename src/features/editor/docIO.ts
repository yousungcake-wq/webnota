import { DOMParser as PMDOMParser, DOMSerializer, Node as PMNode } from '@tiptap/pm/model'
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap'
import type * as Y from 'yjs'
import { docSchema } from './schema'

/**
 * Page documents as ProseMirror JSON / HTML for import and export (feedback 11). Loaded
 * with the editor chunk's schema; React-free.
 */

let schema: ReturnType<typeof docSchema> | null = null
const getSchema = () => (schema ??= docSchema())

/** A page document's body as ProseMirror JSON. */
export function docToJSON(doc: Y.Doc): Record<string, unknown> {
  return yXmlFragmentToProsemirrorJSON(doc.getXmlFragment('default')) as Record<string, unknown>
}

/** Writes ProseMirror JSON into an empty page document. */
export function jsonIntoDoc(doc: Y.Doc, json: Record<string, unknown>) {
  prosemirrorJSONToYXmlFragment(getSchema(), json, doc.getXmlFragment('default'))
}

/** Parses HTML with the editor's schema (unknown markup becomes text) into an empty page document. */
export function htmlIntoDoc(doc: Y.Doc, html: string) {
  const dom = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body
  const node = PMDOMParser.fromSchema(getSchema()).parse(dom)
  prosemirrorJSONToYXmlFragment(getSchema(), node.toJSON() as Record<string, unknown>, doc.getXmlFragment('default'))
}

/** A page document's body as HTML, the schema's own markup (export, M8-06). */
export function docToHtml(doc: Y.Doc): string {
  const node = PMNode.fromJSON(getSchema(), docToJSON(doc))
  const box = document.createElement('div')
  box.append(DOMSerializer.fromSchema(getSchema()).serializeFragment(node.content, { document }))
  return box.innerHTML
}
