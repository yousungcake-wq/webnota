import { databaseDocNames, listRows, type DbDocs } from '../model/database'
import { referencedDatabaseIds } from '../model/views'
import type * as Y from 'yjs'
import { destroyDoc, openDoc, retainDoc } from './registry'

export const rowDocName = (dbId: string, rowId: string) => `row/${dbId}/${rowId}`

/**
 * Opens a database's schema doc and all of its row shards (spec/02 §1), keeping them
 * loaded until `release()` (SY-01 LRU). Call `release` when the view closes.
 */
export async function openDatabase(dbId: string): Promise<{ docs: DbDocs; release: () => void }> {
  const names = databaseDocNames(dbId)
  const releases = names.map((n) => retainDoc(n))
  const release = () => releases.forEach((r) => r())
  try {
    const [schema, ...shards] = await Promise.all(names.map((n) => openDoc(n)))
    return { docs: { schema: schema!, shards }, release }
  } catch (e) {
    release()
    throw e
  }
}

/** Doc names of the row pages a database has (rows with `hasDoc`, M5-08). */
export async function rowBodyDocNames(dbId: string): Promise<string[]> {
  const { docs, release } = await openDatabase(dbId)
  try {
    return listRows(docs)
      .filter((r) => r.hasDoc)
      .map((r) => rowDocName(dbId, r.id))
  } finally {
    release()
  }
}

/**
 * After views were permanently deleted: removes the local data of each database in
 * `candidates` that no remaining view points at (schema, shards, row pages). The sync
 * engine removes their repository files (M4-02).
 */
export async function destroyUnreferencedDatabases(ws: Y.Doc, candidates: Iterable<string>) {
  const live = referencedDatabaseIds(ws)
  for (const dbId of new Set(candidates)) {
    if (live.has(dbId)) continue
    const { docs, release } = await openDatabase(dbId)
    const rowDocs = listRows(docs)
      .filter((r) => r.hasDoc)
      .map((r) => rowDocName(dbId, r.id))
    release()
    await Promise.all([...databaseDocNames(dbId), ...rowDocs].map((n) => destroyDoc(n)))
  }
}
