import type { Migration } from '../migrate'

/** v13 → v14: `image` block node (ED-B12, M3-04). Version stamp only (spec/02 §6 rule 1). */
export const v14Image: Migration = {
  version: 14,
  name: 'image',
  up() {},
}
