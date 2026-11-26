import { describe, expect, it } from 'vitest'
import { docSchema } from './schema'
import { headingsOf } from './nodes/outline'

describe('headingsOf', () => {
  it('lists headings in order, including ones nested in columns', () => {
    const doc = docSchema().nodeFromJSON({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Intro' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'body' }] },
        {
          type: 'columns',
          content: [
            {
              type: 'column',
              content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Left' }] }],
            },
            { type: 'column', content: [{ type: 'paragraph' }] },
          ],
        },
        { type: 'outline' },
      ],
    })
    expect(headingsOf(doc).map((h) => [h.level, h.text])).toEqual([
      [1, 'Intro'],
      [2, 'Left'],
    ])
  })
})
