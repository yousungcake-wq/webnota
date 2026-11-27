import { describe, expect, it } from 'vitest'
import { createSearch, tokenize } from './engine'

describe('tokenize (WS-07)', () => {
  it('splits on spaces/punctuation; Korean words also get jamo suffixes and 초성', () => {
    const t = tokenize('회의록, Weekly notes!')
    expect(t).toEqual(expect.arrayContaining(['회의록', 'weekly', 'notes', 'ㅇㅡㅣㄹㅗㄱ', 'ㅎㅇㄹ']))
    expect(t).not.toContain('')
  })
})

describe('search engine', () => {
  const make = () => {
    const s = createSearch()
    s.upsert({ id: 'a', title: '주간 회의록', body: '이번 주 결정 사항\n예산 검토' })
    s.upsert({ id: 'b', title: 'Shopping', body: '우유, 계란, 회의실 예약' })
    s.upsert({ id: 'c', title: '여행 계획', body: 'Jeju trip in May' })
    return s
  }

  it('finds Korean words inside longer words, ranks title matches first', () => {
    const r = make().query('회의')
    expect(r.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('matches body text with a snippet around the hit', () => {
    const [hit] = make().query('예산')
    expect(hit!.id).toBe('a')
    expect(hit!.snippet).toContain('예산 검토')
  })

  it('prefix-matches latin words, all terms must match', () => {
    expect(
      make()
        .query('jej')
        .map((x) => x.id),
    ).toEqual(['c'])
    expect(
      make()
        .query('jeju may')
        .map((x) => x.id),
    ).toEqual(['c'])
    expect(make().query('jeju 우유')).toEqual([])
  })

  it('Korean: a syllable still being typed and 초성 find words (es-hangul)', () => {
    expect(
      make()
        .query('회읠')
        .map((x) => x.id),
    ).toEqual(['a'])
    expect(
      make()
        .query('ㅎㅇㄹ')
        .map((x) => x.id),
    ).toEqual(['a'])
    expect(
      make()
        .query('ㅇㅅ')
        .map((x) => x.id),
    ).toEqual(expect.arrayContaining(['a']))
    const [hit] = make().query('예사')
    expect(hit?.id).toBe('a')
    expect(hit?.snippet).toContain('예산')
  })

  it('an index saved in an older format is rejected (so it gets rebuilt)', () => {
    const old = JSON.stringify({ index: JSON.parse(make().toJSON()).index, bodies: {} })
    expect(() => createSearch(old)).toThrow()
  })

  it('updates and removes documents; survives a JSON round trip', () => {
    const s = make()
    s.upsert({ id: 'c', title: '여행 계획', body: '부산 여행' })
    expect(s.query('jeju')).toEqual([])
    s.remove('b')
    expect(s.query('우유')).toEqual([])
    const restored = createSearch(s.toJSON())
    expect(restored.query('부산').map((x) => x.id)).toEqual(['c'])
    expect(restored.has('a')).toBe(true)
  })
})
