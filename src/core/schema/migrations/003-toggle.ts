import type { Migration } from '../migrate'

/**
 * v2 → v3 (M2-03): new ProseMirror node types `toggle`, `toggleSummary`, `toggleContent`.
 * No data changes — the version bump makes older apps open read-only instead of
 * deleting blocks they do not know (spec/02 §6 rule 1).
 */
export const v3Toggle: Migration = {
  version: 3,
  name: 'toggle-nodes',
  up() {},
}
