import { useCallback, useSyncExternalStore } from 'react'
import type { Store } from './createStore'

/** Read a `createStore` value; with a selector, re-render only when the selected value changes (Object.is). */
export function useStore<T>(store: Store<T>): T
export function useStore<T, S>(store: Store<T>, selector: (value: T) => S): S
export function useStore<T, S>(store: Store<T>, selector?: (value: T) => S): T | S {
  const get = useCallback(() => (selector ? selector(store.get()) : store.get()), [store, selector])
  return useSyncExternalStore(store.subscribe, get)
}
