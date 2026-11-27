import type { Migration } from '../migrate'

/** v17 → v18: `linkPreview` block node type (ED-B21, M3-08). Version stamp only (spec/02 §6 rule 1). */
export const v18LinkPreview: Migration = {
  version: 18,
  name: 'link-preview',
  up() {},
}
