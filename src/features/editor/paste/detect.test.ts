import { describe, expect, it } from 'vitest'
import { isCodeEditorHtml, looksLikeMarkdown, singleUrl } from './detect'

describe('looksLikeMarkdown', () => {
  it('detects block syntax', () => {
    for (const md of [
      '# Title',
      'intro\n- a\n- b',
      '1. one\n2. two',
      '- [ ] task',
      '> quote',
      '```js\nx\n```',
      '| a | b |',
    ])
      expect(looksLikeMarkdown(md), md).toBe(true)
  })
  it('detects inline syntax only in multi-line text', () => {
    expect(looksLikeMarkdown('see **this**\nand [that](https://x.y)')).toBe(true)
    expect(looksLikeMarkdown('just **one** line')).toBe(false)
  })
  it('leaves ordinary text alone', () => {
    for (const text of ['hello world', 'line one\nline two', 'price: 3 * 4 = 12', '#hashtag'])
      expect(looksLikeMarkdown(text), text).toBe(false)
  })
})

describe('isCodeEditorHtml', () => {
  it('spots code editor clipboard HTML', () => {
    expect(
      isCodeEditorHtml('<div style="color: #d4d4d4;white-space: pre;"><div><span># Title</span></div></div>'),
    ).toBe(true)
    expect(isCodeEditorHtml('<p>Hello</p>')).toBe(false)
  })
})

describe('singleUrl', () => {
  it('accepts exactly one URL', () => {
    expect(singleUrl(' https://example.com/a?b=1 ')).toBe('https://example.com/a?b=1')
    expect(singleUrl('see https://example.com')).toBeNull()
    expect(singleUrl('ftp://x')).toBeNull()
  })
})
