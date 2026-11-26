import type { Migration } from '../migrate'

/** v9 → v10 (M2-12): node types `columns`, `column` (width) and `outline`. Version stamp only (spec/02 §6 rule 1). */
export const v10ColumnsOutline: Migration = {
  version: 10,
  name: 'columns-outline-nodes',
  up() {},
}
