import * as Y from 'yjs'
import { MIGRATIONS } from './migrations'
import { getSchemaVersion, metaOf, SCHEMA_VERSION } from './version'

export interface Migration {
  /** The version this migration produces (previous version + 1). */
  version: number
  name: string
  /** Upgrades `doc` from `version - 1` to `version`. Pure: only touches `doc`. */
  up(doc: Y.Doc): void
}

/** Transaction origin of migration writes. They sync like user edits (marked dirty). */
export const MIGRATION_ORIGIN = 'migration'

export type SchemaStatus = 'current' | 'migrated' | 'newer' | 'failed'

export interface SchemaCheck {
  status: SchemaStatus
  /** Version found before migrating (NaN when unreadable). */
  docVersion: number
  appVersion: number
  /** Versions applied by this call, in order. */
  applied: number[]
  error?: unknown
}

export interface MigrateOptions {
  migrations?: Migration[]
  appVersion?: number
}

/** Throws unless `migrations` has exactly versions 2..appVersion in order. */
export function checkRegistry(migrations: Migration[], appVersion: number) {
  migrations.forEach((m, i) => {
    const expected = i + 2
    if (m.version !== expected) throw new Error(`migration #${i} must be version ${expected}, got ${m.version}`)
    if (m.version > appVersion) throw new Error(`migration ${m.version} is newer than the app version ${appVersion}`)
  })
  const top = migrations.length + 1
  if (top < appVersion) throw new Error(`missing migration for version ${top + 1}`)
}

/**
 * Brings `doc` up to `appVersion` (spec/02 §6).
 *
 * - older: runs each pending migration as its own atomic step. The migration runs on
 *   a scratch copy; only if it succeeds is the difference applied to `doc` in one
 *   transaction (origin `MIGRATION_ORIGIN`) together with the new `schemaVersion`.
 *   A throwing migration therefore leaves `doc` exactly as the previous step left it.
 * - newer or unreadable: writes nothing; the caller opens the app read-only.
 */
export function migrateDoc(doc: Y.Doc, opts: MigrateOptions = {}): SchemaCheck {
  const migrations = opts.migrations ?? MIGRATIONS
  const appVersion = opts.appVersion ?? SCHEMA_VERSION
  const docVersion = getSchemaVersion(doc)
  const base = { docVersion, appVersion }

  if (Number.isNaN(docVersion) || docVersion > appVersion) return { status: 'newer', ...base, applied: [] }

  const applied: number[] = []
  for (const m of migrations) {
    if (m.version <= docVersion || m.version > appVersion) continue
    try {
      const scratch = new Y.Doc({ gc: false })
      Y.applyUpdate(scratch, Y.encodeStateAsUpdate(doc))
      scratch.transact(() => {
        m.up(scratch)
        metaOf(scratch).set('schemaVersion', m.version)
      })
      const diff = Y.encodeStateAsUpdate(scratch, Y.encodeStateVector(doc))
      scratch.destroy()
      Y.applyUpdate(doc, diff, MIGRATION_ORIGIN)
      applied.push(m.version)
    } catch (error) {
      return { status: 'failed', ...base, applied, error }
    }
  }
  return { status: applied.length ? 'migrated' : 'current', ...base, applied }
}
