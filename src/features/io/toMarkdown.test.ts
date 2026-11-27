import { describe, expect, it } from 'vitest'
import { pageToMarkdown, type PMNode } from './toMarkdown'

const p = (text: string, marks?: PMNode['marks']): PMNode => ({
  type: 'paragraph',
  content: [{ type: 'text', text, marks }],
})
const ctx = {
  page: (id: string) => (id === 'v1' ? { title: 'Other page', href: 'Other%20page%20v1.md' } : null),
  file: (_id: string, name: string) => `files/${name}`,
}

describe('Markdown export (feedback 11)', () => {
  it('writes headings, marks, lists, tasks, quotes, code and rules', () => {
    const doc: PMNode = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Sub' }] },
        p('bold', [{ type: 'bold' }]),
        p('link', [{ type: 'link', attrs: { href: 'https://x.y' } }]),
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [p('a'), { type: 'bulletList', content: [{ type: 'listItem', content: [p('b')] }] }],
            },
          ],
        },
        { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p('c')] }] },
        { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p('done')] }] },
        { type: 'blockquote', content: [p('quote')] },
        { type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'let a = 1' }] },
        { type: 'horizontalRule' },
      ],
    }
    expect(pageToMarkdown('Title', doc, ctx)).toBe(
      '# Title\n\n## Sub\n\n**bold**\n\n[link](https://x.y)\n\n- a\n  - b\n\n3. c\n\n- [x] done\n\n> quote\n\n```ts\nlet a = 1\n```\n\n---\n',
    )
  })

  it('writes WebNota blocks the way Notion reads them', () => {
    const doc: PMNode = {
      type: 'doc',
      content: [
        { type: 'callout', attrs: { icon: '💡' }, content: [p('note')] },
        {
          type: 'toggle',
          content: [
            { type: 'toggleSummary', content: [{ type: 'text', text: 'more' }] },
            { type: 'toggleContent', content: [p('hidden')] },
          ],
        },
        { type: 'mathBlock', attrs: { latex: 'x^2' } },
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { kind: 'page', viewId: 'v1' } },
            { type: 'inlineMath', attrs: { latex: 'y' } },
          ],
        },
        { type: 'image', attrs: { src: 'a'.repeat(64) + '.png', caption: 'cat' } },
        {
          type: 'columns',
          content: [
            { type: 'column', content: [p('L')] },
            { type: 'column', content: [p('R')] },
          ],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [p('h1')] },
                { type: 'tableHeader', content: [p('h2')] },
              ],
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [p('1')] },
                { type: 'tableCell', content: [p('2')] },
              ],
            },
          ],
        },
        { type: 'subPage', attrs: { viewId: 'v1' } },
      ],
    }
    expect(pageToMarkdown('T', doc, ctx)).toBe(
      '# T\n\n<aside>\n💡 note\n</aside>\n\n- more\n  hidden\n\n$$\nx^2\n$$\n\n[Other page](Other%20page%20v1.md)$y$\n\n![cat](files/cat)\n\nL\n\nR\n\n| h1 | h2 |\n| --- | --- |\n| 1 | 2 |\n\n[Other page](Other%20page%20v1.md)\n',
    )
  })
})
