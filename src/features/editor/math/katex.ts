import type * as KatexNs from 'katex'

/**
 * KaTeX, loaded when a document shows or inserts math (ED-B15, ED-I06; spec/10: ≤120KB
 * with its CSS). Fonts are not precached by the service worker; they are cached on use.
 */
type Katex = typeof KatexNs.default
let katex: Katex | null = null
let loading: Promise<Katex> | null = null

export const loadKatex = () =>
  (loading ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => (katex = m.default)))

export const katexLoaded = () => katex

/** Renders LaTeX into `el` (errors shown inline, never thrown; no \href/\url or HTML). */
export function renderMath(el: HTMLElement, latex: string, display: boolean) {
  if (!katex) return false
  katex.render(latex, el, {
    displayMode: display,
    throwOnError: false,
    trust: false,
    strict: 'ignore',
    output: 'htmlAndMathml',
    maxSize: 50,
    maxExpand: 1000,
  })
  return true
}
