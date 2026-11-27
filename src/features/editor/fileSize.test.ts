import { describe, expect, it } from 'vitest'
import { formatSize } from './nodes/file'
import { docSchema } from './schema'

describe('file block (ED-B14)', () => {
  it('formats sizes', () => {
    expect(formatSize(0)).toBe('')
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(1536)).toBe('1.5 KB')
    expect(formatSize(25 * 1024 * 1024)).toBe('25 MB')
  })
  it('round-trips its attributes through JSON', () => {
    const schema = docSchema()
    const attrs = { fileId: `${'b'.repeat(64)}.pdf`, name: '보고서.pdf', size: 1234, mime: 'application/pdf' }
    const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'file', attrs }] })
    expect(doc.firstChild!.attrs).toMatchObject(attrs)
  })
})
