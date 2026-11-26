import { IndexeddbPersistence, storeState } from 'y-indexeddb'
import * as Y from 'yjs'
import { LEGACY_COPY_MARKER, legacyCopyDone, renameDirty } from './registry'

/**
 * Schema v2 renamed page docs `page/<id>` → `doc/<id>` (spec/02 §7). Each doc is its own
 * IndexedDB database, so they are copied once per device: read the old DB, merge it into
 * the new one, force-write, then delete the old DB. A failed copy keeps the old DB and
 * leaves the marker unset, so the next boot retries (merging is idempotent).
 */

const PREFIX = 'webnota:'
const OLD = /^webnota:page\/(.+)$/

export interface LegacyCopyEnv {
  /** All IndexedDB database names; absent where `indexedDB.databases()` is unsupported. */
  listDatabases?: () => Promise<string[]>
  /** Candidate ids when databases cannot be listed (the workspace's view ids). */
  fallbackIds?: () => string[]
  isDone(): boolean
  markDone(): void
  renameDirty(from: string, to: string): void
}

async function copyOne(id: string): Promise<boolean> {
  const old = new Y.Doc()
  const oldP = new IndexeddbPersistence(`${PREFIX}page/${id}`, old)
  await oldP.whenSynced
  const hasData = Y.encodeStateVector(old).length > 1
  if (hasData) {
    const next = new Y.Doc()
    const nextP = new IndexeddbPersistence(`${PREFIX}doc/${id}`, next)
    await nextP.whenSynced
    Y.applyUpdate(next, Y.encodeStateAsUpdate(old))
    await storeState(nextP, true)
    await nextP.destroy()
    next.destroy()
  }
  await oldP.clearData() // deletes the old database
  old.destroy()
  return hasData
}

/** Returns the ids that were copied. */
export async function copyLegacyDocs(env: LegacyCopyEnv): Promise<string[]> {
  if (env.isDone()) return []
  const ids = env.listDatabases
    ? (await env.listDatabases()).flatMap((n) => OLD.exec(n)?.slice(1) ?? [])
    : (env.fallbackIds?.() ?? [])
  const copied: string[] = []
  let failed = false
  for (const id of ids) {
    try {
      if (await copyOne(id)) copied.push(id)
      env.renameDirty(`page/${id}`, `doc/${id}`)
    } catch (e) {
      failed = true
      console.error('[webnota] copying legacy doc failed', id, e)
    }
  }
  if (!failed) env.markDone()
  return copied
}

/** Boot-time copy with the real environment (localStorage marker, `indexedDB.databases`). */
export function runLegacyDocCopy(viewIds: () => string[]): Promise<string[]> {
  const list = typeof indexedDB.databases === 'function' ? indexedDB.databases.bind(indexedDB) : null
  return copyLegacyDocs({
    listDatabases: list ? async () => (await list()).map((d) => d.name ?? '') : undefined,
    fallbackIds: viewIds,
    isDone: legacyCopyDone,
    markDone: () => {
      try {
        localStorage.setItem(LEGACY_COPY_MARKER, '1')
      } catch {
        /* retried next boot; copying again is a no-op */
      }
    },
    renameDirty,
  })
}
