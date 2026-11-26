import type * as Y from 'yjs'
import { setWriteGuard } from '../model/guard'
import { createStore } from '../store/createStore'
import { migrateDoc, type MigrateOptions, type SchemaStatus } from './migrate'
import { getSchemaVersion, metaOf, SCHEMA_VERSION } from './version'

export interface SchemaState {
  status: SchemaStatus
  /** True when this build must not write: data is newer than the app, or migrating failed. */
  readOnly: boolean
  docVersion: number
  appVersion: number
}

const initial: SchemaState = {
  status: 'current',
  readOnly: false,
  docVersion: SCHEMA_VERSION,
  appVersion: SCHEMA_VERSION,
}

/** Read in React with `useStore(schemaStore)`. */
export const schemaStore = createStore<SchemaState>(initial)

export const isReadOnly = (): boolean => schemaStore.get().readOnly

let detach: (() => void) | null = null

function publish(status: SchemaStatus, docVersion: number, appVersion: number) {
  const readOnly = status === 'newer' || status === 'failed'
  const prev = schemaStore.get()
  if (prev.status === status && prev.docVersion === docVersion && prev.appVersion === appVersion) return
  schemaStore.set({ status, readOnly, docVersion, appVersion })
}

/**
 * Read-only gate for the workspace doc (spec/02 §6). Migrates it if older, then keeps
 * watching `meta`: when another device's newer `schemaVersion` is merged in, the app
 * becomes read-only synchronously (before the sync engine can push), and an older
 * version arriving (a merge of concurrent bumps) re-runs the idempotent migrations.
 * While read-only, `core/model` mutations throw `ReadOnlyError`.
 */
export function initSchema(doc: Y.Doc, opts: MigrateOptions = {}): SchemaState {
  detach?.()
  const appVersion = opts.appVersion ?? SCHEMA_VERSION
  setWriteGuard(() => !isReadOnly())

  const run = () => {
    const r = migrateDoc(doc, { ...opts, appVersion })
    publish(r.status, Number.isNaN(r.docVersion) ? r.docVersion : getSchemaVersion(doc), appVersion)

    if (r.status === 'failed') console.error('[webnota:schema] migration failed', r.error)
  }
  run()

  const meta = metaOf(doc)
  const onMeta = (e: Y.YMapEvent<unknown>) => {
    if (!e.keysChanged.has('schemaVersion')) return
    const v = getSchemaVersion(doc)
    if (Number.isNaN(v) || v > appVersion) publish('newer', v, appVersion)
    else if (v < appVersion)
      queueMicrotask(run) // can't write inside an observer
    else if (schemaStore.get().status === 'newer') publish('current', v, appVersion)
  }
  meta.observe(onMeta)
  detach = () => meta.unobserve(onMeta)
  return schemaStore.get()
}

/** Tests only. */
export function resetSchemaGate() {
  detach?.()
  detach = null
  setWriteGuard(() => true)
  schemaStore.set(initial)
}
