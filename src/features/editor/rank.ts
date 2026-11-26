/** Block lookup helpers shared by the slash menu, the phone block panel and "turn into" (ED-F01). */
export type BlockCategory = 'basic' | 'list' | 'advanced'

export interface Rankable {
  id: string
  title: string
  keywords: string[]
  category: BlockCategory
}

const ORDER: BlockCategory[] = ['basic', 'list', 'advanced']
const RECENT_KEY = 'webnota:recent-blocks'

export function recentBlocks(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as unknown
    return Array.isArray(v) ? (v as string[]) : []
  } catch {
    return []
  }
}

export function recordBlockUse(id: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recentBlocks().filter((x) => x !== id)].slice(0, 5)))
  } catch {
    /* ignore */
  }
}

/**
 * No query: the 3 most recently used first, then by category. With a query: title
 * prefix > title contains > keyword prefix > keyword contains; ties keep registry order.
 */
export function rankBlocks<T extends Rankable>(blocks: T[], query: string, recent: string[] = []): T[] {
  const q = query.trim().toLowerCase()
  if (!q) {
    const top = recent.slice(0, 3).flatMap((id) => blocks.filter((b) => b.id === id))
    const rest = blocks.filter((b) => !top.includes(b))
    return [...top, ...ORDER.flatMap((c) => rest.filter((b) => b.category === c))]
  }
  const score = (b: T) => {
    const title = b.title.toLowerCase()
    if (title.startsWith(q)) return 4
    if (title.includes(q)) return 3
    if (b.keywords.some((k) => k.startsWith(q))) return 2
    if (b.keywords.some((k) => k.includes(q))) return 1
    return 0
  }
  return blocks
    .map((b, i) => ({ b, s: score(b), i }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .map((x) => x.b)
}
