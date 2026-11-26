import { describe, expect, it } from 'vitest'
import { rankBlocks, type Rankable } from './rank'

const b = (id: string, title: string, category: Rankable['category'], keywords: string[] = []): Rankable => ({
  id,
  title,
  category,
  keywords,
})
const blocks = [
  b('text', '텍스트', 'basic', ['text', 'paragraph']),
  b('h1', '제목 1', 'basic', ['h1', 'heading', 'title']),
  b('bullet', '글머리 기호 목록', 'list', ['bullet', 'list']),
  b('code', '코드', 'advanced', ['code']),
  b('todo', '할 일 목록', 'list', ['todo', 'task']),
]

describe('rankBlocks (ED-F01)', () => {
  it('no query: recent first, then categories in order', () => {
    expect(rankBlocks(blocks, '', ['code', 'todo']).map((x) => x.id)).toEqual(['code', 'todo', 'text', 'h1', 'bullet'])
  })
  it('query: title prefix beats keyword matches; non-matches dropped', () => {
    expect(rankBlocks(blocks, '목록').map((x) => x.id)).toEqual(['bullet', 'todo'])
    expect(rankBlocks(blocks, 'li').map((x) => x.id)).toEqual(['bullet'])
    expect(rankBlocks(blocks, 'ti').map((x) => x.id)).toEqual(['h1'])
    expect(rankBlocks(blocks, 'zz')).toEqual([])
  })
})
