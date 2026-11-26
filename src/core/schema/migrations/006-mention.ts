import type { Migration } from '../migrate'

/** v5 → v6 (M2-08): inline node type `mention` (page / date). Version stamp only (spec/02 §6 rule 1). */
export const v6Mention: Migration = {
  version: 6,
  name: 'mention-node',
  up() {},
}
