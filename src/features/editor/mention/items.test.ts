import { describe, expect, it } from 'vitest'
import type { ViewMeta } from '@/core/model/views'
import { mentionItems, type MentionQuery } from './items'

const view = (id: string, title: string, extra: Partial<ViewMeta> = {}): ViewMeta => ({
  id,
  kind: 'document',
  layout: 'document',
  title,
  icon: null,
  parentId: null,
  spaceId: 's',
  order: 'a',
  favorite: false,
  locked: false,
  createdAt: 0,
  createdBy: '',
  updatedAt: 0,
  updatedBy: '',
  deletedAt: null,
  deletedBy: null,
  ...extra,
})

const views = [
  view('a', 'Meeting notes'),
  view('b', 'Weekly meeting'),
  view('c', 'Trashed meeting', { deletedAt: 1 }),
  view('d', 'Child of trashed', { parentId: 'c' }),
  view('e', 'Roadmap'),
]
const base: MentionQuery = { query: '', views, recent: [], today: '2026-11-26', dates: true }
const keys = (q: Partial<MentionQuery>) => mentionItems({ ...base, ...q }).map((i) => i.key)

describe('mentionItems', () => {
  it('matches titles, skipping pages in the trash (directly or via a parent)', () => {
    expect(keys({ query: 'meet' })).toEqual(['p:a', 'p:b'])
    expect(keys({ query: 'child' })).toEqual([])
  })
  it('puts recently opened pages first', () => {
    expect(keys({ query: 'meet', recent: ['b'] })).toEqual(['p:b', 'p:a'])
  })
  it('offers today and tomorrow for an empty query, and a typed date first', () => {
    expect(keys({}).slice(-2)).toEqual(['d:2026-11-26', 'd:2026-11-27'])
    expect(keys({ query: '12/1' })).toEqual(['d:2026-12-01'])
    expect(keys({ query: 'tomorrow' })[0]).toBe('d:2026-11-27')
  })
  it('[[ offers pages only', () => {
    expect(keys({ dates: false }).every((k) => k.startsWith('p:'))).toBe(true)
  })
})
