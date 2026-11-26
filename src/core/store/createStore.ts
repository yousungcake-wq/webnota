/**
 * Minimal external store for screen/device state (spec/01 §6). No React here,
 * so `core/*` modules can own stores; components read them with `useStore`.
 */
export interface Store<T> {
  get(): T
  /** Replaces the value (or derives it from the previous one). No-op when unchanged (Object.is). */
  set(next: T | ((prev: T) => T)): void
  subscribe(listener: () => void): () => void
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next) {
      const v = typeof next === 'function' ? (next as (prev: T) => T)(value) : next
      if (Object.is(v, value)) return
      value = v
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
