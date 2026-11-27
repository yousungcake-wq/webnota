import { describe, expect, it } from 'vitest'
import { hangulMatchesAll, matchRange, queryTokens, searchTokens } from './hangul'

const hit = (text: string, q: string) => {
  const r = matchRange(text, q)
  return r ? text.slice(r[0], r[1]) : null
}

describe('matchRange (Korean-aware substring match)', () => {
  it('plain case-insensitive substring', () => {
    expect(hit('Hello World', 'wor')).toBe('Wor')
  })
  it('a syllable still being typed matches (삭 → 사과)', () => {
    expect(hit('맛있는 사과', '삭')).toBe('사과')
    expect(hit('사과나무', '사곽')).toBe(null)
    expect(hit('사과', '사ㄱ')).toBe('사과')
    expect(hit('닭고기', '달')).toBe('닭')
  })
  it('initial consonants (초성) search', () => {
    expect(hit('회의록 정리', 'ㅎㅇㄹ')).toBe('회의록')
    expect(hit('회의록 정리', 'ㅈㄹ')).toBe('정리')
    expect(hit('회의록', 'ㅎㄹ')).toBe(null)
  })
  it('jamo matches only from a syllable start', () => {
    expect(hit('가구', 'ㅏ')).toBe(null)
    expect(hit('가구', '각')).toBe('가구')
  })
  it('every word of the query must match', () => {
    expect(hangulMatchesAll('주간 회의록', '회 주간')).not.toBeNull()
    expect(hangulMatchesAll('주간 회의록', '회 월간')).toBeNull()
    expect(hangulMatchesAll('anything', '  ')).toEqual([])
  })
})

describe('search tokens (MiniSearch)', () => {
  it('index tokens contain jamo suffixes and initial consonants', () => {
    const t = searchTokens('사과나무 apple')
    expect(t).toContain('사과나무')
    expect(t).toContain('apple')
    expect(t).toContain('ㅅㅏㄱㅗㅏㄴㅏㅁㅜ') // whole word, jamo
    expect(t).toContain('ㄴㅏㅁㅜ') // inner part (나무)
    expect(t).toContain('ㅅㄱㄴㅁ') // 초성
  })
  it('query tokens are prefixes of the index tokens', () => {
    const index = searchTokens('사과나무')
    for (const q of ['삭', '사과', '나무', 'ㅅㄱ', 'ㄴㅁ']) {
      const [qt] = queryTokens(q)
      expect(
        index.some((t) => t.startsWith(qt!)),
        q,
      ).toBe(true)
    }
    expect(queryTokens('Apple')).toEqual(['apple'])
  })
})
