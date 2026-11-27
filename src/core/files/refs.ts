import * as Y from 'yjs'
import { FILE_ID } from '../sync/engine'

/**
 * Which workspace files are still used (SY-04 "storage cleanup", M3-10). Raw Y reads so
 * the scan does not depend on the editor: block attributes that hold a file id
 * (`image.src`, `file.fileId`, `video.src`), the page cover, view/space icons, and in
 * databases (M4-07) media cells and row icons/covers.
 * Anything that looks like a file id counts — when in doubt, a file is kept.
 */
const FILE_ATTRS = ['src', 'fileId']

function walk(node: Y.XmlFragment | Y.XmlElement, out: Set<string>) {
  if (node instanceof Y.XmlElement) {
    for (const a of FILE_ATTRS) {
      const v = node.getAttribute(a) as unknown
      if (typeof v === 'string' && FILE_ID.test(v)) out.add(v)
    }
  }
  for (const child of node.toArray()) {
    if (child instanceof Y.XmlElement || child instanceof Y.XmlFragment) walk(child, out)
  }
}

/** File ids referenced by a page document (`doc/<id>`). */
export function fileRefsInDoc(doc: Y.Doc, out = new Set<string>()): Set<string> {
  walk(doc.getXmlFragment('default'), out)
  const cover = doc.share.has('page') ? (doc.getMap('page').get('cover') as { type?: string; value?: unknown }) : null
  if (cover?.type === 'file' && typeof cover.value === 'string' && FILE_ID.test(cover.value)) out.add(cover.value)
  return out
}

/** File ids referenced by the workspace (view and space icons). */
export function fileRefsInWorkspace(ws: Y.Doc, out = new Set<string>()): Set<string> {
  for (const name of ['views', 'spaces']) {
    if (!ws.share.has(name)) continue
    ws.getMap<Y.Map<unknown>>(name).forEach((m) => {
      const icon = m instanceof Y.Map ? (m.get('icon') as { type?: string; value?: unknown } | null) : null
      if (icon?.type === 'file' && typeof icon.value === 'string' && FILE_ID.test(icon.value)) out.add(icon.value)
    })
  }
  return out
}

const isFileValue = (v: unknown): v is { type: string; value: string } =>
  !!v &&
  typeof v === 'object' &&
  (v as { type?: unknown }).type === 'file' &&
  typeof (v as { value?: unknown }).value === 'string'

/**
 * File ids referenced by a database's row shards (`dbr/<id>/<n>`): media cells (any cell
 * holding `{ fileId }` items, whatever the field type now says — a field changed away from
 * media keeps nothing, but a stale cell must not lose its file) and row icons/covers.
 */
export function fileRefsInRows(shard: Y.Doc, out = new Set<string>()): Set<string> {
  if (!shard.share.has('rows')) return out
  shard.getMap<Y.Map<unknown>>('rows').forEach((row) => {
    if (!(row instanceof Y.Map)) return
    for (const k of ['icon', 'cover']) {
      const v = row.get(k)
      if (isFileValue(v) && FILE_ID.test(v.value)) out.add(v.value)
    }
    const cells = row.get('cells')
    if (!(cells instanceof Y.Map)) return
    cells.forEach((v) => {
      if (!Array.isArray(v)) return
      for (const item of v) {
        const id = item && typeof item === 'object' ? (item as { fileId?: unknown }).fileId : null
        if (typeof id === 'string' && FILE_ID.test(id)) out.add(id)
      }
    })
  })
  return out
}

/** Repository paths under `files/` that no document references. */
export function orphanFiles(repoPaths: string[], referenced: Set<string>): string[] {
  return repoPaths.filter((p) => {
    if (!p.startsWith('files/')) return false
    const id = p.slice('files/'.length)
    // unknown names under files/ (not written by WebNota) are left alone
    return FILE_ID.test(id) && !referenced.has(id)
  })
}
