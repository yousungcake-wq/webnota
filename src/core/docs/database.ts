import { dbDocName, shardDocNames, type DbDocs } from '../model/database'
import { openDoc, retainDoc } from './registry'

/**
 * Opens a database's schema doc and all of its row shards (spec/02 §1), keeping them
 * loaded until `release()` (SY-01 LRU). Call `release` when the view closes.
 */
export async function openDatabase(dbId: string): Promise<{ docs: DbDocs; release: () => void }> {
  const names = [dbDocName(dbId), ...shardDocNames(dbId)]
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
