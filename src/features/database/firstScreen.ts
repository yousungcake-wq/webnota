import { idbName } from '@/core/docs/slots'
import type { DbMeta, FieldMeta, QueryResult, RowSnapshot, ViewSettings } from '@/core/model/database'

/**
 * First-screen cache (M5-00, spec/05 §11): opening a 10k-row database spends most of its
 * time applying nine Yjs docs from IndexedDB. Each view therefore keeps a small plain-JSON
 * copy of what it showed last — schema, view settings, the query result (row ids) and the
 * first rows — in `wn:<wsId>:$dbscreen`, read in parallel with the docs. The session shows
 * it read-only until the live data replaces it (usually well under a second later).
 *
 * The copy is a display cache only: never written back, safe to lose, and removed with the
 * workspace like every `wn:<wsId>:` database.
 */
export interface FirstScreen {
  key: string
  meta: DbMeta
  fields: FieldMeta[]
  view: ViewSettings | null
  result: QueryResult
  /** Snapshots of the first rows of `result` (and of each group, for Board). */
  rows: RowSnapshot[]
  at: number
}

const DB = '$dbscreen'
const STORE = 'screens'
/** Rows kept per screen: a desktop grid or board column shows fewer than this. */
export const SCREEN_ROWS = 60
/** Larger results keep only their first ids (the scroll height is then a guess). */
const MAX_IDS = 50_000

let opening: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(idbName(DB), 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' })
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => {
        db.close()
        opening = null
      }
      resolve(db)
    }
    req.onerror = () => {
      opening = null
      reject(req.error ?? new Error('indexedDB open failed'))
    }
  })
  return opening
}

export const screenKey = (dbId: string, viewId: string) => `${dbId}/${viewId}`

export async function readFirstScreen(key: string): Promise<FirstScreen | null> {
  try {
    const db = await open()
    return await new Promise<FirstScreen | null>((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key) as IDBRequest<FirstScreen | undefined>
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function writeFirstScreen(screen: FirstScreen): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(screen)
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve()
    })
  } catch {
    /* a display cache: losing a write is fine */
  }
}

/** The ids whose rows a screen needs: the first rows overall and of every group. */
export function screenRowIds(result: QueryResult, n = SCREEN_ROWS): string[] {
  const ids = new Set(result.rowIds.slice(0, n))
  for (const g of result.groups ?? []) for (const id of g.rowIds.slice(0, n)) ids.add(id)
  return [...ids]
}

/** Builds the cached copy of a live view (`row` reads the session's row snapshots). */
export function makeFirstScreen(
  key: string,
  s: { meta: DbMeta; fields: FieldMeta[]; view: ViewSettings | null; result: QueryResult },
  row: (id: string) => RowSnapshot | null,
): FirstScreen {
  const rows = screenRowIds(s.result)
    .map(row)
    .filter((r): r is RowSnapshot => !!r)
  const result: QueryResult = { ...s.result, rowIds: s.result.rowIds.slice(0, MAX_IDS) }
  return { key, meta: s.meta, fields: s.fields, view: s.view, result, rows, at: Date.now() }
}
