import * as Y from 'yjs'
import { getSchemaVersion, metaOf, SCHEMA_VERSION } from './version'

export interface Migration {
  /** The version this migration produces (previous version + 1). */
  version: number
  name: string
  /** Upgrades `doc` from `version - 1` to `version`. Pure: only touches `doc`. Must be idempotent. */
  up(doc: Y.Doc, ctx: MigrationContext): void
  /**
   * True when the doc (already at or past `version`) still holds data in the old shape —
   * e.g. merged in from a device that had not upgraded yet. `up` is then run again.
   * Keep it cheap: it is checked after every remote update.
   */
  leftover?(doc: Y.Doc): boolean
}

/** Device-side inputs a migration may record (labels, timestamps) — never used for IDs. */
export interface MigrationContext {
  now: number
  /** Localized name of the space created for existing pages (v2). */
  defaultSpaceName: string
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
  /** Defaults to the app registry, loaded lazily by the gate (migrations/index.ts). */
  migrations?: Migration[]
  appVersion?: number
  ctx?: Partial<MigrationContext>
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
 * - current: re-runs already-applied migrations whose `leftover()` finds old-shape data
 *   (merged in from a device that had not upgraded yet), the same atomic way.
 * - newer or unreadable: writes nothing; the caller opens the app read-only.
 */
export function migrateDoc(doc: Y.Doc, opts: MigrateOptions & { migrations: Migration[] }): SchemaCheck {
  const migrations = opts.migrations
  const appVersion = opts.appVersion ?? SCHEMA_VERSION
  const docVersion = getSchemaVersion(doc)
  const base = { docVersion, appVersion }

  if (Number.isNaN(docVersion) || docVersion > appVersion) return { status: 'newer', ...base, applied: [] }

  const ctx: MigrationContext = { now: Date.now(), defaultSpaceName: 'General', ...opts.ctx }
  const applied: number[] = []
  for (const m of migrations) {
    if (m.version > appVersion) continue
    const pending = m.version > docVersion
    if (!pending && !m.leftover?.(doc)) continue
    try {
      const scratch = new Y.Doc({ gc: false })
      Y.applyUpdate(scratch, Y.encodeStateAsUpdate(doc))
      scratch.transact(() => {
        m.up(scratch, ctx)
        if (pending) metaOf(scratch).set('schemaVersion', m.version)
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
