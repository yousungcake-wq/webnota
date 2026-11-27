import { describe, expect, it } from 'vitest'
import { INLINE_MATH_INPUT } from './nodes/math'
import { docSchema } from './schema'

const match = (s: string) => INLINE_MATH_INPUT.exec(s)?.[1] ?? null

describe('math (ED-B15, ED-I06)', () => {
  it('$…$ becomes inline math only when it looks like a formula', () => {
    expect(match('area $\\pi r^2$')).toBe('\\pi r^2')
    expect(match('$x$')).toBe('x')
    expect(match('(see $a+b$')).toBe('a+b')
    expect(match('costs $5 and $')).toBeNull() // ends with a space before $
    expect(match('$ x$')).toBeNull()
    expect(match('price$5$')).toBeNull() // no word boundary before
  })
  it('keeps LaTeX through JSON; plain text export shows the source', () => {
    const schema = docSchema()
    const doc = schema.nodeFromJSON({
      type: 'doc',
      content: [
        { type: 'mathBlock', attrs: { latex: '\\int_0^1 x\\,dx' } },
        { type: 'paragraph', content: [{ type: 'inlineMath', attrs: { latex: 'e^{i\\pi}' } }] },
      ],
    })
    expect(doc.child(0).attrs.latex).toBe('\\int_0^1 x\\,dx')
    expect(doc.child(1).textBetween(0, doc.child(1).content.size, '', (n) => `$${n.attrs.latex}$`)).toBe('$e^{i\\pi}$')
  })
})
