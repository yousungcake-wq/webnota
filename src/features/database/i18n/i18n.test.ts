import { describe, expect, it } from 'vitest'
import { initI18n } from '@/core/i18n'
import { en } from './en'
import { dt, loadDbMessages } from './index'
import { ko } from './ko'

describe('database dictionary', () => {
  it('loads with the chunk and translates', async () => {
    await initI18n('ko')
    await loadDbMessages()
    expect(dt('db.comingSoon')).toBe(ko['db.comingSoon'])
  })

  it('every English message has the same parameters as the Korean one', () => {
    const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const keys = Object.keys(ko) as (keyof typeof ko)[]
    expect(keys.filter((k) => params(ko[k]).join() !== params(en[k]).join())).toEqual([])
    expect(Object.keys(en).sort()).toEqual([...keys].sort())
  })
})
