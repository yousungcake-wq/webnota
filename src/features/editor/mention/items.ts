import { matchRange } from '@/core/text/hangul'
import { isAlive, type IconValue, type ViewMeta } from '@/core/model/views'
import { addDays, parseDateQuery } from './dates'

/** One row of the `@` / `[[` menu. */
export type MentionItem =
  | { kind: 'page'; key: string; viewId: string; title: string; icon: IconValue | null }
  | { kind: 'date'; key: string; date: string }

export interface MentionQuery {
  query: string
  views: ViewMeta[]
  /** Recently opened view ids, newest first. */
  recent: string[]
  today: string
  /** Relative-day words of the current language (e.g. 오늘 → 0). */
  words?: Record<string, number>
  /** `[[` offers pages only. */
  dates: boolean
  limit?: number
}

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Items for the mention menu (ED-I04, ED-I05): alive pages whose title contains the
 * query (recently opened first, then where the match starts), plus dates — today and
 * tomorrow when the query is empty, or the date the query spells.
 */
export function mentionItems(q: MentionQuery): MentionItem[] {
  const query = norm(q.query)
  const byId = new Map(q.views.map((v) => [v.id, v]))
  const recentRank = new Map(q.recent.map((id, i) => [id, i]))
  const pages = q.views
    .filter((v) => isAlive(byId, v.id))
    .map((v) => ({ v, at: query ? (matchRange(v.title, query)?.[0] ?? -1) : 0 }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => {
      const ra = recentRank.get(a.v.id) ?? Infinity
      const rb = recentRank.get(b.v.id) ?? Infinity
      if (ra !== rb) return ra - rb
      return a.at - b.at || a.v.title.localeCompare(b.v.title)
    })
    .slice(0, q.limit ?? 8)
    .map(({ v }): MentionItem => ({ kind: 'page', key: `p:${v.id}`, viewId: v.id, title: v.title, icon: v.icon }))
  if (!q.dates) return pages
  const typed = parseDateQuery(q.query, q.today, q.words)
  if (typed) return [{ kind: 'date', key: `d:${typed}`, date: typed }, ...pages]
  if (!query) {
    const dates: MentionItem[] = [q.today, addDays(q.today, 1)].map((date) => ({
      kind: 'date',
      key: `d:${date}`,
      date,
    }))
    return [...pages.slice(0, 5), ...dates]
  }
  return pages
}
