import type * as Y from 'yjs'

/**
 * Schema version of the data this build reads and writes (spec/02 §6).
 * Bump it — and add `migrations/NNN-name.ts` — whenever the stored shape changes,
 * including every new ProseMirror node or mark type (older apps must go read-only
 * instead of dropping content they don't know).
 */
export const SCHEMA_VERSION = 11

/** Version of PoC data, which predates `meta.schemaVersion`. */
export const LEGACY_VERSION = 1

export const metaOf = (doc: Y.Doc) => doc.getMap<unknown>('meta')

/**
 * The doc's schema version. Missing → `LEGACY_VERSION` (PoC data). Anything that is
 * not a positive integer → NaN, which callers must treat as "newer than us" (read-only).
 */
export function getSchemaVersion(doc: Y.Doc): number {
  const meta = doc.share.has('meta') ? metaOf(doc) : null
  if (!meta?.has('schemaVersion')) return LEGACY_VERSION
  const v = meta.get('schemaVersion')
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : NaN
}
