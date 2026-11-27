import type { Migration } from '../migrate'

/**
 * v18 → v19: database views (spec/02 §4, M4-01) — workspace views of kind `database`
 * pointing at `db/<id>` + `dbr/<id>/<n>` docs. Older apps would open them as documents
 * and could write a stray page doc, so they must go read-only. Version stamp only.
 */
export const v19Database: Migration = {
  version: 19,
  name: 'database',
  up() {},
}
