import type * as Y from 'yjs'
import { setWriteGuard } from '../model/guard'
import { createStore } from '../store/createStore'
import { MIGRATION_ORIGIN, migrateDoc, type MigrateOptions, type SchemaStatus } from './migrate'
import { LEFTOVERS } from './migrations/leftovers'
import { getSchemaVersion, SCHEMA_VERSION } from './version'

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
 * watching it: when another device's newer `schemaVersion` is merged in, the app
 * becomes read-only synchronously (before the sync engine can push); an older version
 * (a merge of concurrent bumps) or old-shape data from a not-yet-upgraded device
 * re-runs the idempotent migrations.
 * While read-only, `core/model` mutations throw `ReadOnlyError`.
 */
export async function initSchema(doc: Y.Doc, opts: MigrateOptions = {}): Promise<SchemaState> {
  detach?.()
  const appVersion = opts.appVersion ?? SCHEMA_VERSION
  setWriteGuard(() => !isReadOnly())
  const leftovers = opts.migrations ?? LEFTOVERS
  const needsMigration = (v: number) => v < appVersion || leftovers.some((m) => m.version <= v && m.leftover?.(doc))

  const run = async () => {
    const v = getSchemaVersion(doc)
    if (Number.isNaN(v) || v > appVersion) return publish('newer', v, appVersion)
    if (!needsMigration(v)) return publish('current', v, appVersion)
    // The migrations themselves load only when there is something to migrate.
    const migrations = opts.migrations ?? (await import('./migrations')).MIGRATIONS
    const r = migrateDoc(doc, { ...opts, migrations, appVersion })
    publish(r.status, Number.isNaN(r.docVersion) ? r.docVersion : getSchemaVersion(doc), appVersion)
    if (r.status === 'failed') console.error('[webnota:schema] migration failed', r.error)
  }
  await run()

  // After every change (remote merges included): a newer version locks writes at once,
  // before the sync engine can push; an older version or old-shape leftovers re-run the
  // idempotent migrations (deferred: no writes inside an update handler).
  let scheduled = false
  const onUpdate = (_u: Uint8Array, origin: unknown) => {
    if (origin === MIGRATION_ORIGIN) return
    const v = getSchemaVersion(doc)
    if (Number.isNaN(v) || v > appVersion) return publish('newer', v, appVersion)
    if (needsMigration(v)) {
      if (!scheduled) {
        scheduled = true
        queueMicrotask(() => {
          scheduled = false
          void run()
        })
      }
    } else if (schemaStore.get().status === 'newer') publish('current', v, appVersion)
  }
  doc.on('update', onUpdate)
  detach = () => doc.off('update', onUpdate)
  return schemaStore.get()
}

/** Tests only. */
export function resetSchemaGate() {
  detach?.()
  detach = null
  setWriteGuard(() => true)
  schemaStore.set(initial)
}
