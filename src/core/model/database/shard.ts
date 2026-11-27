/** Rows are split into a fixed number of shard docs per database (spec/02 §1). */
export const SHARD_COUNT = 8

/** FNV-1a 32-bit — stable across devices and versions (never change it: rows would move). */
export function hashId(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export const shardOf = (rowId: string, count = SHARD_COUNT) => hashId(rowId) % count

export const dbDocName = (dbId: string) => `db/${dbId}`
export const shardDocName = (dbId: string, n: number) => `dbr/${dbId}/${n}`
export const shardDocNames = (dbId: string, count = SHARD_COUNT) =>
  Array.from({ length: count }, (_, n) => shardDocName(dbId, n))
/** The docs every open database needs: schema + all row shards (spec/02 §1). */
export const databaseDocNames = (dbId: string) => [dbDocName(dbId), ...shardDocNames(dbId)]
