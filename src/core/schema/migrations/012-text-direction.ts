import type { Migration } from '../migrate'

/** v11 → v12 (M2-17): block attribute `dir` (ltr / rtl / auto). Version stamp only (spec/02 §6 rule 1). */
export const v12TextDirection: Migration = {
  version: 12,
  name: 'text-direction',
  up() {},
}
