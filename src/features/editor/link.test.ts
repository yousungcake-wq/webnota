import { describe, expect, it } from 'vitest'
import { normalizeUrl } from './link'

describe('normalizeUrl', () => {
  it('adds https to bare domains and keeps explicit schemes', () => {
    expect(normalizeUrl('example.com/a')).toBe('https://example.com/a')
    expect(normalizeUrl(' http://x.y ')).toBe('http://x.y')
    expect(normalizeUrl('mailto:a@b.c')).toBe('mailto:a@b.c')
    expect(normalizeUrl('#heading')).toBe('#heading')
    expect(normalizeUrl('   ')).toBe('')
  })
})
