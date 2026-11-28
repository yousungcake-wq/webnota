import type { Migration } from '../migrate'

/**
 * v24 → v25 (M6-04): database field type `rollup` — computed from a relation (options
 * `relationFieldId`, `targetFieldId`, `fn`), no stored cells. Older apps would show it as an
 * empty, editable column, so they go read-only. Version stamp only.
 */
export const v25Rollup: Migration = {
  version: 25,
  name: 'rollup',
  up() {},
}
