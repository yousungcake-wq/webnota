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
import { REMOTE_ORIGIN } from '../sync/origins'
import { isReadOnly } from '../schema/gate'
import { currentWorkspaceId, idbName } from './slots'
import { createTabRelay, TAB_ORIGIN } from './tabs'
export { REMOTE_ORIGIN }

export const WORKSPACE = 'workspace'
export const pageDocName = (id: string) => `doc/${id}`

interface Entry {
  doc: Y.Doc
  ready: Promise<Y.Doc>
  persistence: IndexeddbPersistence
  lastUsed: number
}

const registry = new Map<string, Entry>()

/** Live updates and sync messages between tabs of this workspace (SY-02e). */
export const tabs = createTabRelay(`webnota:${currentWorkspaceId()}`, (name) => registry.get(name)?.doc)

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

// Another tab changed the dirty set (its edits, or the leader's sync clearing flags).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== DIRTY_KEY) return
    dirty = readJSON(DIRTY_KEY, {})
    dirtyListeners.forEach((l) => l())
  })
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

// ---- LRU (SY-01): at most `limit` docs in memory ----
let limit = 30
/** Docs used this recently are never unloaded (callers may still hold them across awaits). */
const GRACE_MS = 10_000
const refs = new Map<string, number>()
let evictTimer: ReturnType<typeof setTimeout> | undefined

/** Tests only. */
export function setDocLimit(n: number) {
  limit = n
}

export const loadedDocCount = () => registry.size

/**
 * Keeps `name` loaded until the returned release function is called (a visible page,
 * a running sync). Can be called before `openDoc`. Releasing twice is a no-op.
 */
export function retainDoc(name: string): () => void {
  refs.set(name, (refs.get(name) ?? 0) + 1)
  let released = false
  return () => {
    if (released) return
    released = true
    const n = (refs.get(name) ?? 1) - 1
    if (n > 0) refs.set(name, n)
    else refs.delete(name)
    scheduleEvict()
  }
}

function scheduleEvict() {
  if (evictTimer !== undefined) return
  evictTimer = setTimeout(() => {
    evictTimer = undefined
    evictIdleDocs()
  }, 1000)
}

/**
 * Unloads least recently used docs beyond the limit that are not retained, not dirty,
 * not the workspace and not used within the grace period. Their data is already in
 * IndexedDB; reopening reads it back.
 */
export function evictIdleDocs() {
  if (registry.size <= limit) return
  const now = Date.now()
  for (const [name, entry] of registry) {
    if (registry.size <= limit) break
    if (name === WORKSPACE || refs.has(name) || dirty[name] || now - entry.lastUsed < GRACE_MS) continue
    registry.delete(name)
    void entry.persistence.destroy()
    entry.doc.destroy()
  }
}

export function openDoc(name: string): Promise<Y.Doc> {
  const existing = registry.get(name)
  if (existing) {
    // Map order is the LRU order: move to the end.
    registry.delete(name)
    existing.lastUsed = Date.now()
    registry.set(name, existing)
    return existing.ready
  }
  const doc = new Y.Doc({ guid: name, gc: true })
  const persistence = new IndexeddbPersistence(idbName(name), doc)
  tabs.attach(name, doc, [persistence])
  doc.on('update', (_update: Uint8Array, origin: unknown) => {
    // TAB_ORIGIN: made in another tab, which marked it dirty itself.
    if (origin === REMOTE_ORIGIN || origin === persistence || origin === TAB_ORIGIN) return
    // Read-only (spec/02 §6): nothing local may be queued for upload. Backstop — the
    // editor and core/model already refuse writes; the sync controller skips pushes.
    if (isReadOnly()) return
    markDirty(name)
  })
  const ready = persistence.whenSynced.then(() => doc)
  registry.set(name, { doc, ready, persistence, lastUsed: Date.now() })
  if (registry.size > limit) scheduleEvict()
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
