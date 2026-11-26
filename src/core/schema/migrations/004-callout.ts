import type { Migration } from '../migrate'

/** v3 → v4 (M2-04): node type `callout`. Version stamp only (spec/02 §6 rule 1). */
export const v4Callout: Migration = {
  version: 4,
  name: 'callout-node',
  up() {},
}
