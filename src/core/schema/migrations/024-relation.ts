import type { Migration } from '../migrate'

/**
 * v23 → v24 (M6-01): database field type `relation` — cells hold target row ids
 * (`rowId[]`), options `targetDatabaseId`, `twoWay`, `pairedFieldId`. Older apps would show
 * the ids as text and could overwrite them, so they go read-only. Version stamp only.
 */
export const v24Relation: Migration = {
  version: 24,
  name: 'relation',
  up() {},
}
