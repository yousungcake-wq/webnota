import { describe, expect, it } from 'vitest'
import type { ViewMeta } from '@/core/model/views'
import { flattenTree } from './flatten'

const v = (id: string, parentId: string | null, spaceId = 's1', extra: Partial<ViewMeta> = {}) =>
  ({ id, parentId, spaceId, order: id, deletedAt: null, ...extra }) as ViewMeta

describe('flattenTree', () => {
  const views = [v('a', null), v('b', null), v('a1', 'a'), v('a2', 'a'), v('a1x', 'a1'), v('c', null, 's2')]

  it('lists roots of the space, expanding open nodes depth-first', () => {
    expect(flattenTree(views, 's1', new Set()).map((r) => r.view.id)).toEqual(['a', 'b'])
    const rows = flattenTree(views, 's1', new Set(['a', 'a1']))
    expect(rows.map((r) => `${r.view.id}:${r.depth}:${r.hasChildren ? 'p' : '-'}`)).toEqual([
      'a:0:p',
      'a1:1:p',
      'a1x:2:-',
      'a2:1:-',
      'b:0:-',
    ])
  })

  it('skips trashed views and their subtrees', () => {
    const rows = flattenTree(
      [...views.slice(0, 2), v('a1', 'a', 's1', { deletedAt: 1 }), v('a1x', 'a1')],
      's1',
      new Set(['a', 'a1']),
    )
    expect(rows.map((r) => r.view.id)).toEqual(['a', 'b'])
    expect(rows[0]!.hasChildren).toBe(false)
  })
})
