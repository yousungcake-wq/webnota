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
import { v14Image } from './014-image'
import { v15File } from './015-file'
import { v16VideoEmbed } from './016-video-embed'
import { v17Math } from './017-math'
import { v18LinkPreview } from './018-link-preview'
import { v19Database } from './019-database'
import { v20MediaLayout } from './020-media-layout'
import { v21DbViews } from './021-db-views'
import { v22RowPages } from './022-row-pages'
import { v23InlineDatabase } from './023-inline-database'
import { v24Relation } from './024-relation'
import { v25Rollup } from './025-rollup'

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
  v14Image, // M3-04: image block node type (version stamp only)
  v15File, // M3-05: file attachment block node type (version stamp only)
  v16VideoEmbed, // M3-06: video / embed block node types (version stamp only)
  v17Math, // M3-07: mathBlock / inlineMath node types (version stamp only)
  v18LinkPreview, // M3-08: linkPreview block node type (version stamp only)
  v19Database, // M4-01: database views + db/dbr docs (version stamp only)
  v20MediaLayout, // feedback: image captionAlign, video align/caption/captionAlign (version stamp only)
  v21DbViews, // M5-01: database view tabs, board / calendar layouts (version stamp only)
  v22RowPages, // M5-08: row page bodies row/<db>/<row> (version stamp only)
  v23InlineDatabase, // M5-10: inline database block node type (version stamp only)
  v24Relation, // M6-01: relation field type (version stamp only)
  v25Rollup, // M6-04: rollup field type (version stamp only)
]
