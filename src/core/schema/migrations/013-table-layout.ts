import type { Migration } from '../migrate'

/** v12 → v13: `table.layout` (null = left, center, right, full). Version stamp only (spec/02 §6 rule 1). */
export const v13TableLayout: Migration = {
  version: 13,
  name: 'table-layout',
  up() {},
}
