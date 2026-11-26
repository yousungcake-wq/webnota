import type * as Y from 'yjs'
import { v2Leftover } from './002-views.leftover'

/**
 * `leftover` checks of every migration, without the migrations themselves (those load
 * only when something needs migrating). Keep in step with `MIGRATIONS`.
 */
export const LEFTOVERS: { version: number; leftover: (doc: Y.Doc) => boolean }[] = [
  { version: 2, leftover: v2Leftover },
]
