import { afterEach, describe, expect, it } from 'vitest'
import { setFlag } from '@/core/flags'
import { availableLayouts, VIEW_LAYOUTS } from './newView'

describe('new view layouts (WS-11)', () => {
  afterEach(() => setFlag('database', false))

  it('lists all four layouts; only documents are available without the database flag', () => {
    expect(VIEW_LAYOUTS.map((l) => l.layout)).toEqual(['document', 'grid', 'board', 'calendar'])
    expect(availableLayouts().map((l) => l.layout)).toEqual(['document'])
  })

  it('offers Grid behind the database flag (M4)', () => {
    setFlag('database', true)
    expect(availableLayouts().map((l) => l.layout)).toEqual(['document', 'grid'])
  })
})
