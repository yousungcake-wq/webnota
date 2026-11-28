import { describe, expect, it } from 'vitest'
import { markdownToHtml } from './markdown'

describe('markdownToHtml math (M8-01)', () => {
  it('$$ blocks and $ inline math; prices stay text', () => {
    const html = markdownToHtml('넓이는 $\\pi r^2$ 이고 값은 $5 와 $10 입니다\n\n$$\n\\sum_{i=1}^n i\n$$\n')
    expect(html).toContain('<span data-inline-math data-latex="\\pi r^2"></span>')
    expect(html).toContain('$5 와 $10')
    expect(html).toContain('<div data-math-block data-latex="\\sum_{i=1}^n i"></div>')
  })
  it('escapes the latex attribute', () => {
    expect(markdownToHtml('$a<b "c"$')).toContain('data-latex="a&lt;b &quot;c&quot;"')
  })
})
