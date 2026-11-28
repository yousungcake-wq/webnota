import { getToken } from '../auth/auth'
import { destroyDoc, openDoc, pageDocName, retainDoc } from '../docs/registry'
import { docForPath } from '../sync/engine'
import { syncStore } from '../sync/controller'
import { cacheMeta, deleteFiles } from './db'
import { databaseDocNames } from '../model/database/shard'
import { referencedDatabaseIds } from '../model/views'
import { rowDocName } from '../docs/database'
import { fileRefsInDoc, fileRefsInRows, fileRefsInWorkspace, rowsWithBody } from './refs'
import { pendingFiles } from './upload'

/**
 * "Clean up storage" (SY-04, M3-10, settings): sync first so every page is current, then
 * collect the files all pages use — trashed pages included, they can be restored — and
 * remove the rest from the repository in one commit. Loaded only when run.
 */
export class CleanupError extends Error {
  constructor(public reason: 'not-connected' | 'offline' | 'sync-failed') {
    super(reason)
  }
}

export async function cleanupRepository(): Promise<{ removed: number; kept: number }> {
  const account = syncStore.get().account
  const token = getToken()
  if (!account || !token) throw new CleanupError('not-connected')
  if (globalThis.navigator?.onLine === false) throw new CleanupError('offline')
  const net = await import('../sync/remote')
  if (!(await net.runSession(account, token)).ok) throw new CleanupError('sync-failed')

  const ws = await openDoc('workspace')
  const refs = fileRefsInWorkspace(ws)
  for (const id of ws.getMap('views').keys()) {
    const name = pageDocName(id)
    const release = retainDoc(name)
    try {
      fileRefsInDoc(await openDoc(name), refs)
    } finally {
      release()
    }
  }
  // databases (M4-07): media cells and row icons/covers in every shard (trashed views included)
  const rowsByDb = new Map<string, Set<string>>()
  for (const dbId of referencedDatabaseIds(ws)) {
    const rows = new Set<string>()
    rowsByDb.set(dbId, rows)
    for (const name of databaseDocNames(dbId).slice(1)) {
      const release = retainDoc(name)
      let bodies: string[]
      try {
        const shard = await openDoc(name)
        fileRefsInRows(shard, refs)
        if (shard.share.has('rows')) shard.getMap('rows').forEach((_r, id) => rows.add(id))
        bodies = rowsWithBody(shard).map((rowId) => rowDocName(dbId, rowId))
      } finally {
        release()
      }
      // row page bodies (M5-08)
      for (const body of bodies) {
        const releaseBody = retainDoc(body)
        try {
          fileRefsInDoc(await openDoc(body), refs)
        } finally {
          releaseBody()
        }
      }
    }
  }
  // never remove what is still waiting to be uploaded
  for (const f of await pendingFiles()) refs.add(f.id)

  const res = await net.cleanRepository(account, token, refs, rowsByDb)
  const removedIds = res.removed.filter((p) => p.startsWith('files/')).map((p) => p.slice('files/'.length))
  await deleteFiles('cache', removedIds).catch(() => {})
  // removed row page bodies: drop the local copies too
  for (const p of res.removed) {
    const doc = docForPath(p)
    if (doc?.startsWith('row/')) await destroyDoc(doc).catch(() => {})
  }
  return { removed: res.removed.length, kept: res.kept }
}

/** Bytes of files cached on this device (shown in settings). */
export async function cacheBytes(): Promise<number> {
  return (await cacheMeta()).reduce((n, m) => n + m.size, 0)
}
