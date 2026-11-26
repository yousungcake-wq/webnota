import type { Node as PMNode } from '@tiptap/pm/model'

/** Find & replace (ED-F07): matches within each text block (pure, unit-tested). */

export interface Match {
  from: number
  to: number
}

/** Placeholder for inline leaves (mentions, hard breaks): one character, like their size. */
const LEAF = '￼'

export function findMatches(doc: PMNode, query: string, caseSensitive: boolean): Match[] {
  if (!query) return []
  const needle = caseSensitive ? query : query.toLowerCase()
  const out: Match[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    const raw = node.textBetween(0, node.content.size, '', LEAF)
    const hay = caseSensitive ? raw : raw.toLowerCase()
    let i = hay.indexOf(needle)
    while (i >= 0) {
      out.push({ from: pos + 1 + i, to: pos + 1 + i + needle.length })
      i = hay.indexOf(needle, i + needle.length)
    }
    return false
  })
  return out
}

/** Index of the first match at or after `pos` (wrapping to 0). */
export function matchAfter(matches: Match[], pos: number): number {
  const i = matches.findIndex((m) => m.from >= pos)
  return i < 0 ? 0 : i
}
