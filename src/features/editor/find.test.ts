import { describe, expect, it } from 'vitest'
import { findMatches, matchAfter } from './find/find'
import { docSchema } from './schema'

const schema = docSchema()
const doc = schema.nodeFromJSON({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Cat and ' },
        { type: 'text', text: 'cat', marks: [{ type: 'bold' }] },
        { type: 'mention', attrs: { kind: 'date', date: '2026-01-01' } },
        { type: 'text', text: ' catalog' },
      ],
    },
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'CAT' }] },
  ],
})

describe('findMatches', () => {
  it('finds across marks, ignoring case by default, with positions that select the text', () => {
    const m = findMatches(doc, 'cat', false)
    expect(m).toHaveLength(4)
    for (const { from, to } of m) expect(doc.textBetween(from, to).toLowerCase()).toBe('cat')
  })
  it('respects case when asked', () => {
    expect(findMatches(doc, 'cat', true)).toHaveLength(2)
    expect(findMatches(doc, 'CAT', true)).toHaveLength(1)
  })
  it('matchAfter wraps around', () => {
    const m = findMatches(doc, 'cat', false)
    expect(matchAfter(m, 0)).toBe(0)
    expect(matchAfter(m, m[1]!.from)).toBe(1)
    expect(matchAfter(m, 10_000)).toBe(0)
  })
})
