import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'

/**
 * Every piece of user data lives in a Y.Doc:
 *   - "workspace"     : page tree + page metadata
 *   - "page/<id>"     : the rich-text content of one page
 * Each doc is persisted to IndexedDB immediately (offline-first) and
 * synced to GitHub in batches by the sync engine.
 */

/** Origin used when applying updates that came from GitHub, so they don't mark docs dirty. */
import { REMOTE_ORIGIN } from '../sync/engine'
export { REMOTE_ORIGIN }

export const WORKSPACE = 'workspace'
export const pageDocName = (id: string) => `page/${id}`

interface Entry {
  doc: Y.Doc
  ready: Promise<Y.Doc>
  persistence: IndexeddbPersistence
}

const registry = new Map<string, Entry>()

// ---- dirty tracking (docs with local changes not yet pushed) ----
const DIRTY_KEY = 'webnota:dirty'
let dirty: Record<string, number> = readJSON(DIRTY_KEY, {})
const dirtyListeners = new Set<() => void>()

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: dirty set stays in memory */
  }
}

export function markDirty(name: string) {
  dirty = { ...dirty, [name]: (dirty[name] ?? 0) + 1 }
  writeJSON(DIRTY_KEY, dirty)
  dirtyListeners.forEach((l) => l())
}

export function getDirty(): Record<string, number> {
  return dirty
}

/** Clears the dirty flag only if no edit happened after `gen` was captured. */
export function clearDirty(name: string, gen: number) {
  if (dirty[name] !== gen) return
  const next = { ...dirty }
  delete next[name]
  dirty = next
  writeJSON(DIRTY_KEY, dirty)
  dirtyListeners.forEach((l) => l())
}

export function onDirtyChange(cb: () => void) {
  dirtyListeners.add(cb)
  return () => dirtyListeners.delete(cb)
}

export function openDoc(name: string): Promise<Y.Doc> {
  const existing = registry.get(name)
  if (existing) return existing.ready
  const doc = new Y.Doc({ guid: name, gc: true })
  const persistence = new IndexeddbPersistence(`webnota:${name}`, doc)
  doc.on('update', (_update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_ORIGIN || origin === persistence) return
    markDirty(name)
  })
  const ready = persistence.whenSynced.then(() => doc)
  registry.set(name, { doc, ready, persistence })
  return ready
}

export function getLoadedDoc(name: string): Y.Doc | undefined {
  return registry.get(name)?.doc
}

export async function destroyDoc(name: string) {
  const entry = registry.get(name)
  if (entry) {
    registry.delete(name)
    await entry.persistence.clearData()
    entry.doc.destroy()
  } else {
    const p = new IndexeddbPersistence(`webnota:${name}`, new Y.Doc())
    await p.whenSynced
    await p.clearData()
  }
}
