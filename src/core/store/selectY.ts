import type * as Y from 'yjs'

/**
 * A memoised view of a Y.Doc for `useSyncExternalStore` (no React here, so it is
 * unit-testable). The selector re-runs only after the doc changed, and the
 * previous result is kept when `isEqual` says nothing relevant changed — so
 * unrelated edits do not re-render the component.
 */
export interface YSelection<T> {
  subscribe(onChange: () => void): () => void
  getSnapshot(): T
}

const versions = new WeakMap<Y.Doc, number>()

/** Per-doc change counter, bumped by one 'update' listener installed on first use. */
function versionOf(doc: Y.Doc): number {
  let v = versions.get(doc)
  if (v === undefined) {
    v = 0
    versions.set(doc, v)
    doc.on('update', () => versions.set(doc, (versions.get(doc) ?? 0) + 1))
  }
  return v
}

export function selectY<T>(
  doc: Y.Doc,
  selector: (doc: Y.Doc) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): YSelection<T> {
  let seen = -1
  let value: T
  return {
    subscribe(onChange) {
      versionOf(doc) // the counter's listener must run before onChange
      doc.on('update', onChange)
      return () => doc.off('update', onChange)
    },
    getSnapshot() {
      const v = versionOf(doc)
      if (v !== seen) {
        const next = selector(doc)
        if (seen === -1 || !isEqual(value, next)) value = next
        seen = v
      }
      return value
    },
  }
}
