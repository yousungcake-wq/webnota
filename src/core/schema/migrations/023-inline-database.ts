import type { Migration } from '../migrate'

/**
 * v22 → v23 (M5-10): block node type `database` (databaseId, viewId, layout, height) — an
 * inline database view inside a page — and embedded database views (`embedded: true`,
 * child of the page). Older apps would delete the unknown block, so they go read-only.
 * Version stamp only.
 */
export const v23InlineDatabase: Migration = {
  version: 23,
  name: 'inline-database',
  up() {},
}
