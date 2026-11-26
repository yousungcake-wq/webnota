import { describe, expect, it } from 'vitest'
import { shallowEqual, shallowItemsEqual } from './equality'

describe('shallowEqual', () => {
  it('compares one level deep', () => {
    expect(shallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true)
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(shallowEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(shallowEqual({ a: {} }, { a: {} })).toBe(false)
    expect(shallowEqual([1, 2], [1, 2])).toBe(true)
    expect(shallowEqual([1], { 0: 1 })).toBe(false)
    expect(shallowEqual(null, null)).toBe(true)
    expect(shallowEqual<unknown>(null, {})).toBe(false)
    expect(shallowEqual(NaN, NaN)).toBe(true)
  })
})

describe('shallowItemsEqual', () => {
  it('compares arrays of records item by item', () => {
    expect(shallowItemsEqual([{ id: 'a', n: 1 }], [{ id: 'a', n: 1 }])).toBe(true)
    expect(shallowItemsEqual([{ id: 'a', n: 1 }], [{ id: 'a', n: 2 }])).toBe(false)
    expect(shallowItemsEqual([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }])).toBe(false)
  })
})
