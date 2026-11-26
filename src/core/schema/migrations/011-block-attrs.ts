import type { Migration } from '../migrate'

/**
 * v10 → v11 (M2-13): block attributes `blockId` (block links), `textColor` / `bgColor`
 * (block colors) and `textAlign`. Version stamp only: an older app would drop the
 * attributes when editing (spec/02 §6 rule 1).
 */
export const v11BlockAttrs: Migration = {
  version: 11,
  name: 'block-attrs',
  up() {},
}
