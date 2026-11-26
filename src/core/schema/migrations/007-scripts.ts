import type { Migration } from '../migrate'

/** v6 → v7 (M2-09): mark types `superscript` and `subscript`. Version stamp only (spec/02 §6 rule 1). */
export const v7Scripts: Migration = {
  version: 7,
  name: 'script-marks',
  up() {},
}
