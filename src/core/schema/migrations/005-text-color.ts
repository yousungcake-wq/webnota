import type { Migration } from '../migrate'

/**
 * v4 → v5 (M2-07): mark type `textStyle` (text color) and a `color` attribute on
 * `highlight`. Version stamp only (spec/02 §6 rule 1): an older app would drop the
 * new mark/attribute when editing, so it must open v5 documents read-only.
 */
export const v5TextColor: Migration = {
  version: 5,
  name: 'text-color-mark',
  up() {},
}
