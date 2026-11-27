import type { Migration } from '../migrate'

/** v16 → v17: `mathBlock` and `inlineMath` node types (ED-B15, ED-I06, M3-07). Version stamp only. */
export const v17Math: Migration = {
  version: 17,
  name: 'math',
  up() {},
}
