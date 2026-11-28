import { describe, expect, it } from 'vitest'
import { availableLayouts, VIEW_LAYOUTS } from './newView'

describe('new view layouts (WS-11)', () => {
  it('offers all four layouts (M5-11: the database flag is gone)', () => {
    expect(VIEW_LAYOUTS.map((l) => l.layout)).toEqual(['document', 'grid', 'board', 'calendar'])
    expect(availableLayouts().map((l) => l.layout)).toEqual(['document', 'grid', 'board', 'calendar'])
  })
})
