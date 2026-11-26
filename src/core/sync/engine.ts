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
 *  4. Delete files of pages that no longer exist in the workspace.
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
}

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

export const REMOTE_ORIGIN = 'webnota-remote'
const DATA_DIR = 'data/'

/**
 * Doc name ↔ repository path. `doc/<id>` still lives at the PoC path `data/pages/<id>.yjs`
 * until M0-17 moves it to `data/docs/` (spec/02 §1, SY-02a).
 */
export function pathForDoc(name: string): string | null {
  if (name === 'workspace') return `${DATA_DIR}workspace.yjs`
  if (name.startsWith('doc/')) return `${DATA_DIR}pages/${name.slice(4)}.yjs`
  return null
}

export function docForPath(path: string): string | null {
  if (path === `${DATA_DIR}workspace.yjs`) return 'workspace'
  const m = /^data\/pages\/([A-Za-z0-9_-]+)\.yjs$/.exec(path)
  return m ? `doc/${m[1]}` : null
}

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

    if (head && head.commitSha === state.headSha && dirtyNames.length === 0) {
      return result
    }

    // ---- pull ----
    const remote = new Map<string, string>()
    if (head) {
      for (const e of await api.getTree(head.treeSha)) {
        if (docForPath(e.path)) remote.set(e.path, e.sha)
      }
    }
    // Workspace first so we know which views exist before touching their files.
    const remotePaths = [...remote.keys()].sort(
      (a, b) => Number(b.endsWith('workspace.yjs')) - Number(a.endsWith('workspace.yjs')),
    )
    for (const path of remotePaths) {
      const sha = remote.get(path)!
      if (state.blobs[path] === sha) continue
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

    for (const name of dirtyNames) {
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
      if (name.startsWith('doc/') && !livePages.has(name.slice(4))) {
        entries.push({ path, sha: null })
        newBlobs[path] = null
      }
    }

    if (entries.length === 0) {
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
    pushedGens.forEach(([n, g]) => store.clearDirty(n, g))
    result.pushed = entries.filter((e) => e.sha).length
    result.deleted = entries.filter((e) => !e.sha).length
    result.commitSha = commit
    return result
  }
  throw new ConflictRetryError('sync conflicts persisted after retries')
}
