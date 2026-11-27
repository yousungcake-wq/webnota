import { openDatabase } from '@/core/docs/database'
import {
  getRow,
  listFields,
  listRows,
  observeRows,
  observeSchema,
  readDbMeta,
  readViewSettings,
  type DbDocs,
  type DbMeta,
  type FieldMeta,
  type QueryResult,
  type RowSnapshot,
  type ViewSettings,
} from '@/core/model/database'
import { getCurrentUser } from '@/core/model/views'
import { createStore, type Store } from '@/core/store/createStore'
import { createQueryRunner, type QueryRunner } from './query/runner'

export interface DbState {
  docs: DbDocs
  meta: DbMeta
  fields: FieldMeta[]
  view: ViewSettings | null
  result: QueryResult
  /** Bumped on every row change: cells read with `getRow` are fresh after it. */
  rowsVersion: number
  search: string
}

/**
 * One open database view (M4-04): owns the docs (retained), the schema/row observers and
 * the incremental query. Row changes reach the query as just those rows; schema or view
 * setting changes recompute it (spec/05 §2).
 */
export interface DbSession {
  store: Store<DbState | null>
  setSearch(q: string): void
  row(id: string): RowSnapshot | null
  close(): void
}

export function openDbSession(dbId: string, viewId: string): DbSession {
  const store = createStore<DbState | null>(null)
  let closed = false
  let cleanup: (() => void) | null = null
  let search = ''
  let docs: DbDocs | null = null
  let runner: QueryRunner | null = null

  const queryInput = (fields: FieldMeta[], view: ViewSettings | null) => ({
    fields,
    view: view ?? { filter: null, sorts: [] },
    now: Date.now(),
    me: getCurrentUser(),
    search,
  })

  const refreshSchema = () => {
    if (!docs || !runner) return
    const fields = listFields(docs)
    const view = readViewSettings(docs, viewId)
    store.set((s) => s && { ...s, fields, view, meta: readDbMeta(docs!) })
    runner.setQuery(queryInput(fields, view))
  }

  void openDatabase(dbId).then(({ docs: d, release }) => {
    if (closed) return release()
    docs = d
    const fields = listFields(d)
    const view = readViewSettings(d, viewId)
    const onResult = (result: QueryResult) =>
      store.set((s) =>
        s
          ? { ...s, result, rowsVersion: s.rowsVersion + 1 }
          : { docs: d, meta: readDbMeta(d), fields, view, result, rowsVersion: 0, search },
      )
    runner = createQueryRunner({ ...queryInput(fields, view), rows: listRows(d) }, onResult)
    const offRows = observeRows(d, (ids) => {
      const upserts: RowSnapshot[] = []
      const deletes: string[] = []
      for (const id of ids) {
        const r = getRow(d, id)
        if (r) upserts.push(r)
        else deletes.push(id)
      }
      runner!.apply({ upserts, deletes })
    })
    const offSchema = observeSchema(d, refreshSchema)
    const r = runner
    cleanup = () => {
      offRows()
      offSchema()
      r.dispose()
      release()
    }
  })

  return {
    store,
    setSearch(q) {
      if (q === search) return
      search = q
      store.set((s) => s && { ...s, search: q })
      if (docs && runner) runner.setQuery(queryInput(listFields(docs), readViewSettings(docs, viewId)))
    },
    row: (id) => (docs ? getRow(docs, id) : null),
    close() {
      closed = true
      cleanup?.()
      cleanup = null
    },
  }
}
