import { describe, expect, it } from 'vitest'
import type { ViewMeta } from '@/core/model/views'
import { flattenTree } from './flatten'
import { dropTarget, zoneAt } from './drop'

const v = (id: string, parentId: string | null) =>
  ({ id, parentId, spaceId: 's', order: id, deletedAt: null }) as ViewMeta
// a, a/a1, a/a2, b, c   (a expanded)
const views = [v('a', null), v('a1', 'a'), v('a2', 'a'), v('b', null), v('c', null)]
const rows = flattenTree(views, 's', new Set(['a']))
const idx = (id: string) => rows.findIndex((r) => r.view.id === id)

describe('drop zones', () => {
  it('top quarter = before, bottom quarter = after, middle = inside', () => {
    expect(zoneAt(0, 32)).toBe('before')
    expect(zoneAt(16, 32)).toBe('inside')
    expect(zoneAt(30, 32)).toBe('after')
  })
})

describe('dropTarget', () => {
  it('before / after a sibling, ignoring the dragged view itself', () => {
    expect(dropTarget(rows, views, idx('c'), 'before', 'b')).toEqual({ parentId: null, index: 1, depth: 0 })
    expect(dropTarget(rows, views, idx('a'), 'before', 'c')).toEqual({ parentId: null, index: 0, depth: 0 })
    expect(dropTarget(rows, views, idx('b'), 'after', 'a1')).toEqual({ parentId: null, index: 2, depth: 0 })
  })

  it('inside a view appends to its children', () => {
    expect(dropTarget(rows, views, idx('b'), 'inside', 'c')).toEqual({ parentId: 'b', index: 0, depth: 1 })
    expect(dropTarget(rows, views, idx('a'), 'inside', 'c')).toEqual({ parentId: 'a', index: 2, depth: 1 })
  })

  it('after an expanded parent means its first child', () => {
    expect(dropTarget(rows, views, idx('a'), 'after', 'c')).toEqual({ parentId: 'a', index: 0, depth: 1 })
  })

  it('refuses dropping onto itself or into its own subtree', () => {
    expect(dropTarget(rows, views, idx('a'), 'inside', 'a')).toBeNull()
    expect(dropTarget(rows, views, idx('a1'), 'inside', 'a')).toBeNull()
    expect(dropTarget(rows, views, idx('a2'), 'before', 'a')).toBeNull()
  })
})
