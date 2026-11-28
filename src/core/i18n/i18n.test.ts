import { beforeEach, describe, expect, it } from 'vitest'
import { en } from './en'
import { detectLang, initI18n, t, tParts } from './index'
import { ko } from './ko'

beforeEach(() => initI18n('ko'))

describe('i18n', () => {
  it('detects Korean from any preferred language, otherwise English', () => {
    expect(detectLang(['ko-KR'])).toBe('ko')
    expect(detectLang(['en-US', 'ko'])).toBe('ko')
    expect(detectLang(['en-GB', 'ja'])).toBe('en')
    expect(detectLang([])).toBe('en')
  })

  it('translates and interpolates', async () => {
    expect(t('common.untitled')).toBe('제목 없음')
    expect(t('search.results', { count: 3 })).toBe('결과 3개')
    await initI18n('en')
    expect(t('common.untitled')).toBe('Untitled')
    expect(t('sync.err.noRepoPermission', { repo: 'x' })).toContain('"x"')
    expect(t('sync.err.noRepoPermission', { repo: 'x' })).not.toContain('{repo}')
  })

  it('leaves unknown parameters as written', () => {
    expect(t('search.results', {})).toBe('결과 {count}개')
  })

  it('splits messages around non-string parameters', async () => {
    const el = { el: true }
    expect(tParts('search.results', { count: el })).toEqual(['결과 ', el, '개'])
    await initI18n('en')
    expect(tParts('search.results', { count: el })).toEqual([el, ' results'])
  })

  it('every English message has the same parameters as the Korean one', () => {
    const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const mismatched = (Object.keys(ko) as (keyof typeof ko)[]).filter(
      (k) => params(ko[k]).join() !== params(en[k]).join(),
    )
    expect(mismatched).toEqual([])
  })
})
