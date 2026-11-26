// Guards for the design tokens (docs/spec/12-design-system.md §1).
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '../../src')
const TOKENS = join(SRC, 'styles/tokens.css')

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? cssFiles(join(dir, e.name)) : e.name.endsWith('.css') ? [join(dir, e.name)] : [],
  )
}
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const tokens = strip(readFileSync(TOKENS, 'utf8'))
const files = cssFiles(SRC).filter((f) => f !== TOKENS)

/** Body of the first rule whose selector is exactly `selector` (no nesting inside token blocks). */
function block(css: string, selector: string): string {
  const i = css.indexOf(`${selector} {`)
  if (i < 0) throw new Error(`missing ${selector}`)
  const start = css.indexOf('{', i) + 1
  return css.slice(start, css.indexOf('}', start))
}
const decls = (body: string) =>
  body
    .split(';')
    .map((d) => d.trim().replace(/\s+/g, ' '))
    .filter(Boolean)

describe('design tokens', () => {
  it('raw colours appear only in tokens.css', () => {
    const offenders = files.flatMap((f) =>
      [...strip(readFileSync(f, 'utf8')).matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi)].map(
        (m) => `${relative(SRC, f)}: ${m[0]}`,
      ),
    )
    expect(offenders).toEqual([])
  })

  it('the system-dark and forced-dark blocks define the same values', () => {
    const media = tokens.slice(tokens.indexOf('@media (prefers-color-scheme: dark)'))
    expect(decls(block(media, ":root:not([data-theme='light'])"))).toEqual(
      decls(block(tokens, ":root[data-theme='dark']")),
    )
  })

  it('every var(--x) used is defined in tokens.css', () => {
    const defined = new Set([...tokens.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
    const missing = files.flatMap((f) =>
      [...strip(readFileSync(f, 'utf8')).matchAll(/var\((--[\w-]+)/g)]
        .filter((m) => !defined.has(m[1]!))
        .map((m) => `${relative(SRC, f)}: ${m[1]}`),
    )
    expect(missing).toEqual([])
  })
})
