import { describe, expect, it } from 'vitest'
import { ensureLanguage, highlight } from './highlighter'

describe('code highlighter (ED-B10)', () => {
  it('loads a grammar on demand and returns class spans with offsets', async () => {
    expect(highlight('const x = 1', 'javascript')).toEqual([])
    expect(await ensureLanguage('javascript')).toBe(true)
    const spans = highlight('const x = 1', 'javascript')
    expect(spans).toContainEqual({ from: 0, to: 5, className: 'hljs-keyword' })
    expect(spans).toContainEqual({ from: 10, to: 11, className: 'hljs-number' })
  })
  it('unknown or plain languages give no spans', async () => {
    expect(await ensureLanguage('plaintext')).toBe(false)
    expect(await ensureLanguage('nope')).toBe(false)
  })
})
