import type { Migration } from '../migrate'

/** v15 → v16: `video` and `embed` block node types (ED-B13, ED-B22, M3-06). Version stamp only. */
export const v16VideoEmbed: Migration = {
  version: 16,
  name: 'video-embed',
  up() {},
}
