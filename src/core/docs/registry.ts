import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'

/**
 * Every piece of user data lives in a Y.Doc:
 *   - "workspace"     : spaces, view tree, per-user state (spec/02 §2)
 *   - "doc/<id>"      : the rich-text content of one document view
 * Each doc is persisted to IndexedDB immediately (offline-first) and
 * synced to GitHub in batches by the sync engine.
 */

/** Origin used when applying updates that came from GitHub, so they don't mark docs dirty. */
import { REMOTE_ORIGIN } from '../sync/engine'
import { isReadOnly } from '../schema/gate'
import { idbName } from './slots'
export { REMOTE_ORIGIN }

export const WORKSPACE = 'workspace'
export const pageDocName = (id: string) => `doc/${id}`

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

/** Set once this device moved its `webnota:*` databases into `wn:<wsId>:*` (core/docs/legacy.ts). */
export const LEGACY_COPY_MARKER = 'webnota:idb-ns'

export function legacyCopyDone(): boolean {
  try {
    return localStorage.getItem(LEGACY_COPY_MARKER) === '1'
  } catch {
    return false
  }
}

/** Moves a dirty flag to a renamed doc (schema v2 `page/` → `doc/`). */
export function renameDirty(from: string, to: string) {
  if (!(from in dirty)) return
  const next = { ...dirty, [to]: (dirty[to] ?? 0) + (dirty[from] ?? 0) }
  delete next[from]
  dirty = next
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
  const persistence = new IndexeddbPersistence(idbName(name), doc)
  doc.on('update', (_update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_ORIGIN || origin === persistence) return
    // Read-only (spec/02 §6): nothing local may be queued for upload. Backstop — the
    // editor and core/model already refuse writes; the sync controller skips pushes.
    if (isReadOnly()) return
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
    const p = new IndexeddbPersistence(idbName(name), new Y.Doc())
    await p.whenSynced
    await p.clearData()
  }
}
