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
