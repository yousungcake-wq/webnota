import type * as Y from 'yjs'
import { assertWritable } from './guard'
import { listViews, type IconValue, type ViewMeta } from './views'

/**
 * A shared space's own document (M9, spec/02 §2.1): `data/space.yjs` in the space's
 * repository. It holds the space's meta and its view tree in the same shape as the
 * workspace's `views` map, so every view function (`createView`, `listViews`,
 * `updateView`…) works on it unchanged — the repository is self-contained: someone who
 * only has that repository can open the whole space.
 */
export interface SpaceDocMeta {
  id: string
  name: string
  icon: IconValue | null
  color: string
  createdAt: number
  schemaVersion: number
}

const metaOf = (doc: Y.Doc) => doc.getMap<unknown>('meta')

/** Sets up an empty space document (the creator does this once, then pushes it). */
export function initSpaceDoc(
  doc: Y.Doc,
  opts: { id: string; name: string; icon?: IconValue | null; color?: string; schemaVersion: number },
) {
  assertWritable()
  const m = metaOf(doc)
  doc.transact(() => {
    m.set('schemaVersion', opts.schemaVersion)
    m.set('id', opts.id)
    m.set('name', opts.name)
    m.set('icon', opts.icon ?? null)
    m.set('color', opts.color ?? 'blue')
    m.set('createdAt', Date.now())
  })
}

/** The space document's meta, or null before it has been set up (or synced). */
export function readSpaceDocMeta(doc: Y.Doc): SpaceDocMeta | null {
  const m = metaOf(doc)
  const id = m.get('id')
  if (typeof id !== 'string' || !id) return null
  const icon = m.get('icon')
  return {
    id,
    name: typeof m.get('name') === 'string' ? (m.get('name') as string) : '',
    icon: icon && typeof icon === 'object' ? (icon as IconValue) : null,
    color: typeof m.get('color') === 'string' ? (m.get('color') as string) : 'blue',
    createdAt: typeof m.get('createdAt') === 'number' ? (m.get('createdAt') as number) : 0,
    schemaVersion: typeof m.get('schemaVersion') === 'number' ? (m.get('schemaVersion') as number) : 0,
  }
}

/** Renames / restyles a space in its own document (members see it after sync). */
export function updateSpaceDocMeta(doc: Y.Doc, patch: Partial<Pick<SpaceDocMeta, 'name' | 'icon' | 'color'>>) {
  assertWritable()
  const m = metaOf(doc)
  doc.transact(() => {
    for (const [k, v] of Object.entries(patch)) if (m.get(k) !== v) m.set(k, v)
  })
}

/** The space's views, each tagged with the space id (their roots point at it). */
export function spaceViews(doc: Y.Doc): ViewMeta[] {
  const id = readSpaceDocMeta(doc)?.id
  return id ? listViews(doc).map((v) => (v.spaceId === id ? v : { ...v, spaceId: id })) : []
}
