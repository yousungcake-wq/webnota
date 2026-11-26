import type { Migration } from '../migrate'

/** v7 → v8 (M2-10): block node type `subPage` (viewId). Version stamp only (spec/02 §6 rule 1). */
export const v8SubPage: Migration = {
  version: 8,
  name: 'sub-page-node',
  up() {},
}
