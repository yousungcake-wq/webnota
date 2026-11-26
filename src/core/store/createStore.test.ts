import { describe, expect, it, vi } from 'vitest'
import { createStore } from './createStore'

describe('createStore', () => {
  it('gets, sets by value or updater, and notifies subscribers', () => {
    const s = createStore(1)
    const l = vi.fn()
    const off = s.subscribe(l)
    s.set(2)
    s.set((n) => n + 1)
    expect(s.get()).toBe(3)
    expect(l).toHaveBeenCalledTimes(2)
    off()
    s.set(10)
    expect(l).toHaveBeenCalledTimes(2)
  })

  it('does not notify when the value is unchanged', () => {
    const obj = { a: 1 }
    const s = createStore(obj)
    const l = vi.fn()
    s.subscribe(l)
    s.set(obj)
    s.set((prev) => prev)
    expect(l).not.toHaveBeenCalled()
  })
})
