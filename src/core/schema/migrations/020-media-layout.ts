import type { Migration } from '../migrate'

/**
 * v19 → v20: image `captionAlign`; video `align`, `caption`, `captionAlign` (user feedback
 * 4–5, 2026-11-27). Older apps would drop the new attributes when they rewrite a block, so
 * they go read-only. Version stamp only.
 */
export const v20MediaLayout: Migration = {
  version: 20,
  name: 'media-layout',
  up() {},
}
