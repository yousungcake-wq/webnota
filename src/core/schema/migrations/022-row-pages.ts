import type { Migration } from '../migrate'

/**
 * v21 → v22 (M5-08): database row pages — a row's body is the doc `row/<db>/<row>`
 * (`data/dbs/<db>/rows/<row>.yjs`), flagged on the row with `hasDoc`. Older apps would not
 * show or keep these bodies in step (copying or deleting rows), so they go read-only.
 * Version stamp only.
 */
export const v22RowPages: Migration = {
  version: 22,
  name: 'row-pages',
  up() {},
}
