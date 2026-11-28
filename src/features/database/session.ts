import { openDatabase } from '@/core/docs/database'
import {
  getRow,
  listFields,
  listRows,
  observeRows,
  observeSchema,
  readDbMeta,
  readViewSettings,
  relationOptions,
  repairTwoWay,
  type DbDocs,
  type DbMeta,
  type FieldMeta,
  type QueryResult,
  type RowSnapshot,
  type ViewSettings,
} from '@/core/model/database'
import { getCurrentUser } from '@/core/model/views'
import { createStore, type Store } from '@/core/store/createStore'
import * as Y from 'yjs'
import { makeFirstScreen, readFirstScreen, screenKey, writeFirstScreen } from './firstScreen'
import { createQueryRunner, type QueryRunner } from './query/runner'

export interface DbState {
  dbId: string
  docs: DbDocs
  meta: DbMeta
  fields: FieldMeta[]
  view: ViewSettings | null
  result: QueryResult
  /** Bumped on every row change: cells read with `getRow` are fresh after it. */
  rowsVersion: number
  /** Bumped when a relation target database loads or its rows change (M6-02). */
  targetsVersion: number
  search: string
  /**
   * Showing the first-screen cache while the docs load (M5-00): `docs` are empty
   * placeholders and the view must be read-only until the live state replaces it.
   */
  preview?: boolean
}

/** Placeholder docs for a preview state; nothing written to them is kept. */
const previewDocs = (): DbDocs => ({ schema: new Y.Doc(), shards: [] })

/** Resolves after the next frame was painted (rAF + task), or soon in a hidden tab. */
const afterPaint = () =>
  new Promise<void>((resolve) => {
    const done = () => setTimeout(resolve, 0)
    if (typeof requestAnimationFrame !== 'function' || document.hidden) return done()
    requestAnimationFrame(done)
  })

/** Debounce of first-screen cache writes after the result or rows change. */
const SCREEN_SAVE_MS = 1500

/**
 * One open database view (M4-04): owns the docs (retained), the schema/row observers and
 * the incremental query. Row changes reach the query as just those rows; schema or view
 * setting changes recompute it (spec/05 §2).
 */
export interface DbSession {
  store: Store<DbState | null>
  setSearch(q: string): void
  row(id: string): RowSnapshot | null
  /** The docs of a relation target database (this one included), null while loading. */
  target(dbId: string): DbDocs | null
  close(): void
}

export function openDbSession(dbId: string, viewId: string): DbSession {
  const store = createStore<DbState | null>(null)
  let closed = false
  let cleanup: (() => void) | null = null
  let search = ''
  let docs: DbDocs | null = null
  let runner: QueryRunner | null = null
  /** Row snapshots by id, stable until the row changes (memoized grid rows, M4-14). */
  const rowCache = new Map<string, RowSnapshot | null>()
  const key = screenKey(dbId, viewId)
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  const saveScreen = () => {
    clearTimeout(saveTimer)
    saveTimer = undefined
    const s = store.get()
    // searches are transient: keep the unsearched screen
    if (!s || s.preview || s.search) return
    void writeFirstScreen(makeFirstScreen(key, s, (id) => rowCache.get(id) ?? (docs ? getRow(docs, id) : null)))
  }
  const scheduleSave = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(saveScreen, SCREEN_SAVE_MS)
  }

  const queryInput = (fields: FieldMeta[], view: ViewSettings | null) => ({
    fields,
    view: view ?? { filter: null, sorts: [] },
    now: Date.now(),
    me: getCurrentUser(),
    search,
  })

  // relation targets (M6-02): other databases this one links to, open while the view is
  const targets = new Map<string, { docs: DbDocs | null; release: () => void; off: () => void }>()
  const bumpTargets = () => store.set((s) => (s && !s.preview ? { ...s, targetsVersion: s.targetsVersion + 1 } : s))
  // two-way relations (M6-03): after merges both sides must agree — heal shortly after changes
  let repairTimer: ReturnType<typeof setTimeout> | undefined
  const scheduleRepair = () => {
    clearTimeout(repairTimer)
    repairTimer = setTimeout(() => {
      if (!docs || closed) return
      for (const f of listFields(docs)) {
        const o = relationOptions(f)
        if (f.type !== 'relation' || !o.twoWay) continue
        const target = (o.targetDatabaseId ?? dbId) === dbId ? docs : targets.get(o.targetDatabaseId!)?.docs
        try {
          if (target) repairTwoWay(docs, target, f.id)
        } catch {
          /* read-only (newer schema): nothing to write */
        }
      }
    }, 1500)
  }
  const syncTargets = (fields: FieldMeta[]) => {
    const want = new Set(
      fields
        .filter((f) => f.type === 'relation')
        .map((f) => relationOptions(f).targetDatabaseId)
        .filter((id): id is string => !!id && id !== dbId),
    )
    for (const [id, t] of targets)
      if (!want.has(id)) {
        t.off()
        t.release()
        targets.delete(id)
      }
    for (const id of want) {
      if (targets.has(id)) continue
      const entry = { docs: null as DbDocs | null, release: () => {}, off: () => {} }
      targets.set(id, entry)
      void openDatabase(id).then(({ docs: t, release: rel }) => {
        if (closed || targets.get(id) !== entry) return rel()
        entry.docs = t
        entry.release = rel
        entry.off = observeRows(t, () => {
          bumpTargets()
          scheduleRepair()
        })
        bumpTargets()
        scheduleRepair()
      })
    }
  }

  const refreshSchema = () => {
    if (!docs || !runner) return
    const fields = listFields(docs)
    syncTargets(fields)
    const view = readViewSettings(docs, viewId)
    store.set((s) => (s && !s.preview ? { ...s, fields, view, meta: readDbMeta(docs!) } : s))
    runner.setQuery(queryInput(fields, view))
  }

  // phases of opening, for tests/perf/database.mjs (performance marks are cheap)
  performance.mark('db:open')
  // The cached screen goes first and gets painted before the docs load: applying them is
  // one long main-thread task that would otherwise hold the preview back.
  const preview = readFirstScreen(key).then((c) => {
    if (closed || !c || store.get()) return false
    for (const r of c.rows) rowCache.set(r.id, r)
    performance.mark('db:preview')
    store.set({
      dbId,
      docs: previewDocs(),
      meta: c.meta,
      fields: c.fields,
      view: c.view,
      result: c.result,
      rowsVersion: 0,
      targetsVersion: 0,
      search: '',
      preview: true,
    })
    return true
  })
  void preview
    .then((shown) => (shown ? afterPaint() : undefined))
    .then(() => openDatabase(dbId))
    .then(({ docs: d, release }) => {
      if (closed) return release()
      performance.mark('db:docs')
      docs = d
      const fields = listFields(d)
      const view = readViewSettings(d, viewId)
      const onResult = (result: QueryResult) => {
        const s = store.get()
        if (!s || s.preview) performance.mark('db:query')
        store.set(
          s && !s.preview
            ? { ...s, result, rowsVersion: s.rowsVersion + 1 }
            : {
                dbId,
                docs: d,
                meta: readDbMeta(d),
                // fresh: the schema may have changed while a worker answered the first query
                fields: listFields(d),
                view: readViewSettings(d, viewId),
                result,
                rowsVersion: (s?.rowsVersion ?? 0) + 1,
                targetsVersion: s?.targetsVersion ?? 0,
                search,
              },
        )
        scheduleSave()
      }
      const all = listRows(d)
      rowCache.clear()
      for (const r of all) rowCache.set(r.id, r)
      performance.mark('db:rows')
      runner = createQueryRunner({ ...queryInput(fields, view), rows: all }, onResult)
      const offRows = observeRows(d, (ids) => {
        const upserts: RowSnapshot[] = []
        const deletes: string[] = []
        for (const id of ids) {
          const r = getRow(d, id)
          rowCache.set(id, r)
          if (r) upserts.push(r)
          else deletes.push(id)
        }
        scheduleRepair()
        // repaint the changed cells now; order and filter follow when the query answers (worker)
        store.set((s) => (s && !s.preview ? { ...s, rowsVersion: s.rowsVersion + 1 } : s))
        runner!.apply({ upserts, deletes })
      })
      const offSchema = observeSchema(d, refreshSchema)
      const r = runner
      syncTargets(listFields(d))
      scheduleRepair()
      cleanup = () => {
        clearTimeout(repairTimer)
        for (const t of targets.values()) {
          t.off()
          t.release()
        }
        targets.clear()
        offRows()
        offSchema()
        r.dispose()
        release()
      }
    })

  return {
    store,
    target(id) {
      return id === dbId ? docs : (targets.get(id)?.docs ?? null)
    },
    setSearch(q) {
      if (q === search) return
      search = q
      store.set((s) => s && { ...s, search: q })
      if (docs && runner) runner.setQuery(queryInput(listFields(docs), readViewSettings(docs, viewId)))
    },
    row(id) {
      let r = rowCache.get(id)
      if (r !== undefined) return r
      if (!docs) return null // preview: only the cached first rows
      rowCache.set(id, (r = getRow(docs, id)))
      return r
    },
    close() {
      if (saveTimer !== undefined) saveScreen()
      closed = true
      cleanup?.()
      cleanup = null
    },
  }
}
