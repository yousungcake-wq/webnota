import * as Y from 'yjs'
import { gitBlobSha } from './encoding'

/**
 * Sync algorithm (local-first, CRDT-merged, one commit per sync):
 *
 *  1. Read the branch head. If it equals the head we last saw and nothing is
 *     dirty, stop (1 API request).
 *  2. Read the tree; for every file whose blob sha differs from the last one
 *     we merged, download it and apply it to the local Y.Doc (CRDT merge —
 *     never conflicts).
 *  3. Encode every dirty doc; skip files whose content is byte-identical to
 *     the remote blob; upload the rest as blobs.
 *  4. Delete files of pages that no longer exist in the workspace. Legacy PoC files
 *     (`data/pages/<id>.yjs`) are merged in step 2, re-written at `data/docs/<id>.yjs`
 *     and deleted in the same commit (SY-02a).
 *     Binary files waiting in the upload queue (`pendingFiles`, SY-04) are added as
 *     `files/<sha256>.<ext>`; a file the tree already has is not uploaded again.
 *  5. Create one tree + one commit and fast-forward the branch. If another
 *     device pushed in between, the ref update is rejected and we go back to
 *     step 1 — the next round merges their changes first.
 */

export interface TreeEntry {
  path: string
  sha: string
}

export interface GitApi {
  /** null when the branch does not exist yet */
  getHead(): Promise<{ commitSha: string; treeSha: string } | null>
  getTree(treeSha: string): Promise<TreeEntry[]>
  getBlob(sha: string): Promise<Uint8Array>
  createBlob(bytes: Uint8Array): Promise<string>
  createTree(baseTree: string | null, entries: { path: string; sha: string | null }[]): Promise<string>
  createCommit(message: string, treeSha: string, parents: string[]): Promise<string>
  /** Fast-forwards (or creates) the branch. Returns false if rejected because the head moved. */
  updateHead(commitSha: string, create: boolean): Promise<boolean>
}

export interface LocalStore {
  getDoc(name: string): Promise<Y.Doc>
  getDirty(): Record<string, number>
  clearDirty(name: string, gen: number): void
  /** blob sha per path, as last merged/pushed by this device */
  loadState(): SyncState
  saveState(state: SyncState): void
  /** Binary files waiting for upload (SY-04). The dirty flag `FILES_DIRTY` says there are some. */
  pendingFiles?(): Promise<PendingFile[]>
  /** The files are in the repository now: drop them from the queue. */
  filesUploaded?(ids: string[]): Promise<void>
}

export interface PendingFile {
  /** `<sha256 hex>.<ext>` — the repository path is `files/<id>`. */
  id: string
  bytes: Uint8Array
}

/** Dirty-set entry meaning "the upload queue is not empty" (not a doc: `pathForDoc` is null). */
export const FILES_DIRTY = 'files'
export const FILES_DIR = 'files/'
/** File ids are content addresses: lowercase sha-256 hex + a short extension. */
export const FILE_ID = /^[0-9a-f]{64}\.[a-z0-9]{1,10}$/

export interface SyncState {
  headSha: string | null
  blobs: Record<string, string>
}

export interface SyncResult {
  pulled: number
  pushed: number
  deleted: number
  commitSha: string | null
  attempts: number
}

import { REMOTE_ORIGIN } from './origins'
export { REMOTE_ORIGIN }
const DATA_DIR = 'data/'

const ID = '[A-Za-z0-9_-]+'
const PATHS: [RegExp, (m: string[]) => string][] = [
  [new RegExp(`^data/docs/(${ID})\\.yjs$`), (m) => `doc/${m[1]}`],
  [new RegExp(`^data/dbs/(${ID})/schema\\.yjs$`), (m) => `db/${m[1]}`],
  [new RegExp(`^data/dbs/(${ID})/rows-(\\d+)\\.yjs$`), (m) => `dbr/${m[1]}/${m[2]}`],
  [new RegExp(`^data/dbs/(${ID})/rows/(${ID})\\.yjs$`), (m) => `row/${m[1]}/${m[2]}`],
]
/** PoC (schema v1) location of `doc/<id>`. Read, merged, then moved to data/docs/ (SY-02a). */
const LEGACY_DOC = new RegExp(`^data/pages/(${ID})\\.yjs$`)

/** Repository path of a doc (spec/02 §1), or null if the doc is not synced. */
export function pathForDoc(name: string): string | null {
  if (name === 'workspace') return `${DATA_DIR}workspace.yjs`
  const [kind, a, b] = name.split('/')
  if (!a || !new RegExp(`^${ID}$`).test(a)) return null
  if (kind === 'doc' && b === undefined) return `${DATA_DIR}docs/${a}.yjs`
  if (kind === 'db' && b === undefined) return `${DATA_DIR}dbs/${a}/schema.yjs`
  if (kind === 'dbr' && b !== undefined && /^\d+$/.test(b)) return `${DATA_DIR}dbs/${a}/rows-${b}.yjs`
  if (kind === 'row' && b !== undefined && new RegExp(`^${ID}$`).test(b)) return `${DATA_DIR}dbs/${a}/rows/${b}.yjs`
  return null
}

/** Doc name for a repository path (legacy `data/pages/` included), or null. */
export function docForPath(path: string): string | null {
  if (path === `${DATA_DIR}workspace.yjs`) return 'workspace'
  const legacy = LEGACY_DOC.exec(path)
  if (legacy) return `doc/${legacy[1]}`
  for (const [re, name] of PATHS) {
    const m = re.exec(path)
    if (m) return name(m)
  }
  return null
}

const isLegacyPath = (path: string) => LEGACY_DOC.test(path)

export class ConflictRetryError extends Error {}

export async function syncOnce(
  api: GitApi,
  store: LocalStore,
  opts: {
    maxAttempts?: number
    deviceName?: string
    /** Checked after each pull; false skips pushing (schema read-only gate). Docs stay dirty. */
    canPush?: () => boolean
  } = {},
): Promise<SyncResult> {
  const maxAttempts = opts.maxAttempts ?? 5
  const result: SyncResult = { pulled: 0, pushed: 0, deleted: 0, commitSha: null, attempts: 0 }
  const state = store.loadState()

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    result.attempts = attempt
    const head = await api.getHead()
    const dirty = { ...store.getDirty() }
    const dirtyNames = Object.keys(dirty).filter((n) => pathForDoc(n))

    // Known legacy files still to move keep the round going even with nothing dirty.
    const legacyPending = Object.keys(state.blobs).some(isLegacyPath)
    const filesGen = dirty[FILES_DIRTY]
    if (
      head &&
      head.commitSha === state.headSha &&
      dirtyNames.length === 0 &&
      filesGen === undefined &&
      !legacyPending
    ) {
      return result
    }

    // ---- pull ----
    const remote = new Map<string, string>()
    const remoteFiles = new Set<string>()
    if (head) {
      for (const e of await api.getTree(head.treeSha)) {
        if (docForPath(e.path)) remote.set(e.path, e.sha)
        else if (e.path.startsWith(FILES_DIR)) remoteFiles.add(e.path)
      }
    }
    // Workspace first so we know which views exist before touching their files.
    const remotePaths = [...remote.keys()].sort(
      (a, b) => Number(b.endsWith('workspace.yjs')) - Number(a.endsWith('workspace.yjs')),
    )
    for (const path of remotePaths) {
      const sha = remote.get(path)!
      if (state.blobs[path] === sha) continue
      if (isLegacyPath(path)) {
        // Workspace is applied first (sort above), so liveness is known here.
        const ws = await store.getDoc('workspace')
        if (!ws.getMap('views').has(docForPath(path)!.slice(4))) continue // deleted below, not merged
      }
      const bytes = await api.getBlob(sha)
      const doc = await store.getDoc(docForPath(path)!)
      Y.applyUpdate(doc, bytes, REMOTE_ORIGIN)
      state.blobs[path] = sha
      result.pulled++
    }
    state.headSha = head?.commitSha ?? null
    store.saveState(state)

    if (opts.canPush && !opts.canPush()) return result

    // ---- decide what to push ----
    const ws = await store.getDoc('workspace')
    const livePages = new Set(ws.getMap('views').keys())
    const entries: { path: string; sha: string | null }[] = []
    const pushedGens: [string, number][] = []
    const newBlobs: Record<string, string | null> = {}

    // Legacy data/pages/<id>.yjs files (pulled above): write the doc to its v2 path and
    // delete the old file in the same commit. Pages that no longer exist just lose the file.
    const legacy = [...remote.keys()].filter(isLegacyPath)
    const toPush = new Set(dirtyNames)
    for (const path of legacy) {
      const name = docForPath(path)!
      if (livePages.has(name.slice(4))) toPush.add(name)
      entries.push({ path, sha: null })
      newBlobs[path] = null
    }

    for (const name of toPush) {
      const path = pathForDoc(name)!
      const gen = dirty[name] ?? 0
      if (name.startsWith('doc/') && !livePages.has(name.slice(4))) {
        pushedGens.push([name, gen])
        continue // deleted page: handled below
      }
      const doc = await store.getDoc(name)
      const bytes = Y.encodeStateAsUpdate(doc)
      const sha = await gitBlobSha(bytes)
      if (remote.get(path) === sha) {
        pushedGens.push([name, gen])
        continue
      }
      const uploaded = await api.createBlob(bytes)
      entries.push({ path, sha: uploaded })
      newBlobs[path] = uploaded
      pushedGens.push([name, gen])
    }

    for (const path of remote.keys()) {
      const name = docForPath(path)!
      if (!isLegacyPath(path) && name.startsWith('doc/') && !livePages.has(name.slice(4))) {
        entries.push({ path, sha: null })
        newBlobs[path] = null
      }
    }

    // Binary files (SY-04): content-addressed, so a path the tree has is the same file.
    const uploadedFiles: string[] = []
    if (filesGen !== undefined) {
      for (const f of (await store.pendingFiles?.()) ?? []) {
        uploadedFiles.push(f.id) // malformed ids are dropped from the queue, never retried
        if (!FILE_ID.test(f.id)) continue
        const path = FILES_DIR + f.id
        if (remoteFiles.has(path)) continue
        entries.push({ path, sha: await api.createBlob(f.bytes) })
        remoteFiles.add(path)
      }
      pushedGens.push([FILES_DIRTY, filesGen])
    }

    if (entries.length === 0) {
      if (uploadedFiles.length) await store.filesUploaded?.(uploadedFiles)
      pushedGens.forEach(([n, g]) => store.clearDirty(n, g))
      return result
    }

    // ---- commit ----
    const tree = await api.createTree(head?.treeSha ?? null, entries)
    const msg = `WebNota sync${opts.deviceName ? ` from ${opts.deviceName}` : ''}: ${entries.length} file(s)`
    const commit = await api.createCommit(msg, tree, head ? [head.commitSha] : [])
    const ok = await api.updateHead(commit, !head)
    if (!ok) continue // someone else pushed: merge their changes and try again

    for (const [path, sha] of Object.entries(newBlobs)) {
      if (sha) state.blobs[path] = sha
      else delete state.blobs[path]
    }
    state.headSha = commit
    store.saveState(state)
    if (uploadedFiles.length) await store.filesUploaded?.(uploadedFiles)
    pushedGens.forEach(([n, g]) => store.clearDirty(n, g))
    result.pushed = entries.filter((e) => e.sha).length
    result.deleted = entries.filter((e) => !e.sha).length
    result.commitSha = commit
    return result
  }
  throw new ConflictRetryError('sync conflicts persisted after retries')
}
