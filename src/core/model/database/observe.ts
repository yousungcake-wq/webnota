import type * as Y from 'yjs'
import { rowsOf, type DbDocs } from './model'

/**
 * Calls `cb` with the ids of rows that changed in any shard (added, removed, any field or
 * cell). One call per shard transaction — the input of the incremental query (M4-04).
 */
export function observeRows(db: DbDocs, cb: (ids: Set<string>) => void): () => void {
  const offs = db.shards.map((shard) => {
    const rows = rowsOf(shard)
    const handler = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
      const ids = new Set<string>()
      for (const e of events) {
        if (e.target === rows) e.changes.keys.forEach((_c, key) => ids.add(key))
        else {
          const id = e.path[0]
          if (typeof id === 'string') ids.add(id)
        }
      }
      if (ids.size) cb(ids)
    }
    rows.observeDeep(handler)
    return () => rows.unobserveDeep(handler)
  })
  return () => offs.forEach((off) => off())
}

/** Calls `cb` once per transaction that changes fields, view settings or meta (a full recompute). */
export function observeSchema(db: DbDocs, cb: () => void): () => void {
  const handler = () => cb()
  db.schema.on('update', handler)
  return () => db.schema.off('update', handler)
}
