import { useMemo, useSyncExternalStore } from 'react'
import type * as Y from 'yjs'
import { selectY } from './selectY'

/**
 * Subscribe a component to part of a Y.Doc (spec/01 §6, spec/10 §2).
 * Re-renders only when `isEqual(previous, next)` is false.
 *
 * Pass a stable selector (module-level function or `useCallback`): an inline arrow
 * creates a new subscription each render and loses result identity across renders.
 */
export function useY<T>(doc: Y.Doc, selector: (doc: Y.Doc) => T, isEqual?: (a: T, b: T) => boolean): T {
  const sel = useMemo(() => selectY(doc, selector, isEqual), [doc, selector, isEqual])
  return useSyncExternalStore(sel.subscribe, sel.getSnapshot)
}
