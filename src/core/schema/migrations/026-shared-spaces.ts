import type { Migration } from '../migrate'

/**
 * v25 → v26 (M9-00): shared spaces — `spaces[id].repo` links a space to its own repository,
 * whose `space` document holds that space's views (spec/02 §2.1). Existing spaces have no
 * repo and stay in the home repository, so nothing moves. Older apps would not see shared
 * spaces' pages and could create views into a space they do not hold: read-only. Version
 * stamp only.
 */
export const v26SharedSpaces: Migration = {
  version: 26,
  name: 'shared-spaces',
  up() {},
}
