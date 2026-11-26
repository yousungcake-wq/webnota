import { describe, expect, it } from 'vitest'
import { markdownToHtml } from './markdown'

describe('markdownToHtml', () => {
  it('renders task lists as the editor task list markup', () => {
    const html = markdownToHtml('- [ ] buy\n- [x] done')
    expect(html).toContain('<ul data-type="taskList">')
    expect(html).toContain('data-checked="true"')
    expect(html).toContain('data-checked="false"')
  })
  it('keeps headings, ordered starts and code fences', () => {
    const html = markdownToHtml('# T\n\n3. c\n4. d\n\n```js\nlet a\n```')
    expect(html).toContain('<h1>T</h1>')
    expect(html).toContain('<ol start="3">')
    expect(html).toContain('<code class="language-js">')
  })
})
