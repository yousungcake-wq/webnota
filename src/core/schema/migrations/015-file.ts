import type { Migration } from '../migrate'

/** v14 → v15: `file` attachment block node (ED-B14, M3-05). Version stamp only (spec/02 §6 rule 1). */
export const v15File: Migration = {
  version: 15,
  name: 'file',
  up() {},
}
