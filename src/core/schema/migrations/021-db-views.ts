import type { Migration } from '../migrate'

/**
 * v20 → v21 (M5-01): database view tabs — further views of a database are child views of
 * its first view with the same `databaseId` — and the `board` / `calendar` layouts with
 * their view settings (`group`, `board`, `calendar`). Older apps would show those views as
 * "coming soon" and could overwrite the new settings, so they go read-only. Version stamp only.
 */
export const v21DbViews: Migration = {
  version: 21,
  name: 'db-views',
  up() {},
}
