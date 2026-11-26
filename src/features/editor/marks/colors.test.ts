import { describe, expect, it } from 'vitest'
import { colorAttrs, normalizeColor, pastedColor } from './colors'

describe('normalizeColor', () => {
  it('keeps palette ids and hex values', () => {
    expect(normalizeColor('red')).toBe('red')
    expect(normalizeColor(' Blue ')).toBe('blue')
    expect(normalizeColor('#AABBCC')).toBe('#aabbcc')
    expect(normalizeColor('#abc')).toBe('#aabbcc')
  })
  it('converts rgb() from pasted HTML', () => {
    expect(normalizeColor('rgb(255, 0, 16)')).toBe('#ff0010')
    expect(normalizeColor('rgba(1,2,3,0.5)')).toBe('#010203')
  })
  it('rejects anything else', () => {
    for (const v of ['', 'var(--x)', 'url(x)', 'magenta', '#12345', 3, null]) expect(normalizeColor(v)).toBeNull()
  })
})

describe('colorAttrs', () => {
  it('uses data attributes for palette colors and inline style for custom ones', () => {
    expect(colorAttrs('text', 'red')).toEqual({ 'data-text-color': 'red' })
    expect(colorAttrs('bg', 'red')).toEqual({ 'data-bg-color': 'red' })
    expect(colorAttrs('text', '#112233')).toEqual({ style: 'color: #112233' })
    expect(colorAttrs('bg', null)).toEqual({})
  })
})

describe('pastedColor', () => {
  it('drops grays that other apps put on every span', () => {
    expect(pastedColor('rgb(0, 0, 0)')).toBeNull()
    expect(pastedColor('#ffffff')).toBeNull()
    expect(pastedColor('rgb(34, 34, 40)')).toBeNull()
    expect(pastedColor('rgb(220, 30, 30)')).toBe('#dc1e1e')
    expect(pastedColor('red')).toBe('red')
  })
})
