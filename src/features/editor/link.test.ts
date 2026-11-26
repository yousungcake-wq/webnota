import { describe, expect, it } from 'vitest'
import { internalHash, normalizeUrl } from './link'

describe('normalizeUrl', () => {
  it('adds https to bare domains and keeps explicit schemes', () => {
    expect(normalizeUrl('example.com/a')).toBe('https://example.com/a')
    expect(normalizeUrl(' http://x.y ')).toBe('http://x.y')
    expect(normalizeUrl('mailto:a@b.c')).toBe('mailto:a@b.c')
    expect(normalizeUrl('#heading')).toBe('#heading')
    expect(normalizeUrl('   ')).toBe('')
  })
})

describe('internalHash', () => {
  const base = 'https://u.github.io/webnota/'
  it('recognizes app links and bare hashes', () => {
    expect(internalHash('#/w/a/v/b', base)).toBe('#/w/a/v/b')
    expect(internalHash(`${base}#/w/a/v/b/b/c`, base)).toBe('#/w/a/v/b/b/c')
  })
  it('leaves other sites alone', () => {
    expect(internalHash('https://example.com/#/w/a', base)).toBeNull()
    expect(internalHash('https://example.com', base)).toBeNull()
  })
})
