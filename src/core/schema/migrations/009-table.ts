import type { Migration } from '../migrate'

/**
 * v8 → v9 (M2-11): node types `table`, `tableRow`, `tableHeader`, `tableCell` (cells:
 * colspan, rowspan, colwidth, background, align). Version stamp only (spec/02 §6 rule 1).
 */
export const v9Table: Migration = {
  version: 9,
  name: 'table-nodes',
  up() {},
}
