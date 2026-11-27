import type { Migration } from '../migrate'
import { v2Views } from './002-views'
import { v3Toggle } from './003-toggle'
import { v4Callout } from './004-callout'
import { v5TextColor } from './005-text-color'
import { v6Mention } from './006-mention'
import { v7Scripts } from './007-scripts'
import { v8SubPage } from './008-sub-page'
import { v9Table } from './009-table'
import { v10ColumnsOutline } from './010-columns-outline'
import { v11BlockAttrs } from './011-block-attrs'
import { v12TextDirection } from './012-text-direction'
import { v13TableLayout } from './013-table-layout'

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
  v5TextColor, // M2-07: textStyle mark + highlight color (version stamp only)
  v6Mention, // M2-08: mention node type (version stamp only)
  v7Scripts, // M2-09: superscript / subscript marks (version stamp only)
  v8SubPage, // M2-10: subPage block node type (version stamp only)
  v9Table, // M2-11: table node types (version stamp only)
  v10ColumnsOutline, // M2-12: columns / column / outline node types (version stamp only)
  v11BlockAttrs, // M2-13: blockId / textColor / bgColor / textAlign attributes (version stamp only)
  v12TextDirection, // M2-17: dir attribute (version stamp only)
  v13TableLayout, // table layout attribute: left / center / right / full (version stamp only)
]
