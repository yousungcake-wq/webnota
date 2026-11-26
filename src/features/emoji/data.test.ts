import { describe, expect, it } from 'vitest'
import rows from './emoji-data.json'
import { filterEmoji, suggestEmoji, withSkin, type EmojiRow } from './data'

const list = rows as unknown as EmojiRow[]

describe('emoji data', () => {
  it('searches Korean and English names', () => {
    expect(filterEmoji(list, '하트').map((r) => r[0])).toContain('💜')
    expect(filterEmoji(list, 'purple heart').map((r) => r[0])).toContain('💜')
    expect(filterEmoji(list, '흔드는').map((r) => r[0])).toContain('👋')
  })

  it('applies skin tones after the first code point', () => {
    expect(withSkin('👋', 3, 1)).toBe('👋🏽')
    expect(withSkin('🧑‍💻', 1, 1)).toBe('🧑🏻‍💻')
    expect(withSkin('💜', 3)).toBe('💜')
  })
})

describe('suggestEmoji', () => {
  const small: EmojiRow[] = [
    ['😀', 0, 'grinning face|smile'],
    ['😺', 0, 'grinning cat|cat smile'],
    ['🐱', 1, 'cat face'],
  ]
  it('ranks word starts before substrings and needs a query', () => {
    expect(suggestEmoji(small, 'cat').map((r) => r[0])).toEqual(['😺', '🐱'])
    expect(suggestEmoji(small, 'mile').map((r) => r[0])).toEqual(['😀', '😺'])
    expect(suggestEmoji(small, '')).toEqual([])
  })
})
