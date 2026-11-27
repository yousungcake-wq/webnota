// User-visible text must go through t() (CLAUDE.md rule 5, spec/11). Korean text in
// source outside the dictionaries is almost always a string that skipped i18n.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '../../src')
/** Files allowed to contain Korean: the dictionaries, the language picker names, bilingual seed content. */
const ALLOW = new Set([
  'core/i18n/ko.ts',
  'core/i18n/index.ts',
  'features/editor/seed.ts',
  'features/database/i18n/ko.ts', // lazy feature dictionary (M4-00)
])

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  )
}

it('no Korean string literals outside the i18n dictionaries', () => {
  const offenders: string[] = []
  for (const f of files(SRC)) {
    const rel = relative(SRC, f).replaceAll('\\', '/')
    if (ALLOW.has(rel) || rel.endsWith('.test.ts')) continue
    const code = readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/.*$/gm, '')
    code.split('\n').forEach((line, i) => {
      if (/[가-힣]/.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`)
    })
  }
  expect(offenders).toEqual([])
})
