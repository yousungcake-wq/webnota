import { describe, expect, it } from 'vitest'
import { collapseCrumbs } from './crumbs'

describe('collapseCrumbs', () => {
  it('keeps short trails, collapses the middle of long ones', () => {
    expect(collapseCrumbs([1, 2, 3])).toEqual({ head: [1, 2, 3], hidden: [], tail: [] })
    expect(collapseCrumbs([1, 2, 3, 4, 5])).toEqual({ head: [1], hidden: [2, 3], tail: [4, 5] })
  })
})
