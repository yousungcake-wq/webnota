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

  it('a phone turned sideways stays a phone; a tablet does not (MB-18)', () => {
    expect(computeLayout(915, true, 412).layout).toBe('phone') // Pixel 7 landscape
    expect(computeLayout(844, true, 390).layout).toBe('phone') // iPhone landscape
    expect(computeLayout(1024, true, 768).layout).toBe('desktop') // iPad landscape (also with the keyboard up)
    expect(computeLayout(1133, true, 744).layout).toBe('desktop') // iPad mini landscape
    expect(computeLayout(900, false, 400).layout).toBe('desktop') // a short desktop window
  })

  it('returns the same object for the same result', () => {
    expect(computeLayout(400, true)).toBe(computeLayout(500, true))
    expect(computeLayout(400, true)).not.toBe(computeLayout(400, false))
  })
})
