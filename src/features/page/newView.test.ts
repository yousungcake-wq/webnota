import { describe, expect, it } from 'vitest'
import { availableLayouts, VIEW_LAYOUTS } from './newView'

describe('new view layouts (WS-11)', () => {
  it('lists all four layouts; only documents are available until the database lands', () => {
    expect(VIEW_LAYOUTS.map((l) => l.layout)).toEqual(['document', 'grid', 'board', 'calendar'])
    expect(availableLayouts().map((l) => l.layout)).toEqual(['document'])
  })
})
