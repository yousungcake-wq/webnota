import { describe, expect, it } from 'vitest'
import { computeLayout } from './layout'

describe('computeLayout', () => {
  it('follows spec/08 §1', () => {
    expect(computeLayout(390, true).layout).toBe('phone')
    expect(computeLayout(479, false).layout).toBe('phone')
    expect(computeLayout(767, true).layout).toBe('phone')
    expect(computeLayout(600, false).layout).toBe('tablet') // split-screen window with a mouse (feedback 2-9)
    expect(computeLayout(768, true).layout).toBe('tablet')
    expect(computeLayout(1023, true).layout).toBe('tablet')
    expect(computeLayout(1024, true)).toEqual({ layout: 'desktop', isTouch: true })
    expect(computeLayout(900, false).layout).toBe('desktop') // narrow desktop window
  })

  it('returns the same object for the same result', () => {
    expect(computeLayout(400, true)).toBe(computeLayout(500, true))
    expect(computeLayout(400, true)).not.toBe(computeLayout(400, false))
  })
})
