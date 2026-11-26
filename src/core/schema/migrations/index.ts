import type { Migration } from '../migrate'
import { v2Views } from './002-views'
import { v3Toggle } from './003-toggle'
import { v4Callout } from './004-callout'

/**
 * Migration registry: exactly one entry per version from 2 up to SCHEMA_VERSION,
 * in order (checked by `checkRegistry` in a unit test). Each lives in
 * `NNN-name.ts` with its own `NNN-name.test.ts`.
 *
 * Rules for writing a migration (spec/02 §6):
 * - It is a pure function of the Y.Doc. Don't call `core/model` — the model follows
 *   the *current* schema and will change; a migration must keep working against the
 *   shape of its own version forever. Write raw Y.Map/Y.Array code.
 * - Deterministic and idempotent: several devices can run the same migration on the
 *   same data concurrently and their results merge. Use fixed IDs (e.g. derived from
 *   existing IDs), check before creating, never rely on Math.random/Date.now for keys.
 * - Never delete user content that cannot be rebuilt; copy, then remove the old field.
 */
export const MIGRATIONS: Migration[] = [
  v2Views, // M0-16: pages → views, FracKey, per-user favorites, default space
  v3Toggle, // M2-03: toggle node types (version stamp only)
  v4Callout, // M2-04: callout node type (version stamp only)
]
