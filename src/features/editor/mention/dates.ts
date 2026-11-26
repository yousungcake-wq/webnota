/** Date helpers for date mentions (ED-I05). Dates are stored as local `YYYY-MM-DD`. */

const pad = (n: number) => String(n).padStart(2, '0')

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return isoDate(new Date(y, m - 1, d + days))
}

function valid(y: number, m: number, d: number): string | null {
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? isoDate(date) : null
}

const RELATIVE: Record<string, number> = { today: 0, tomorrow: 1, yesterday: -1 }

/**
 * Date typed after `@`: today/tomorrow/yesterday (English plus `words` from the current
 * language), `2026-12-01`, `2026.12.1`, `12/1`, `12-01`.
 */
export function parseDateQuery(query: string, today: string, words: Record<string, number> = {}): string | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  const rel = words[q] ?? RELATIVE[q]
  if (rel !== undefined) return addDays(today, rel)
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})\.?$/.exec(q)
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})[-./](\d{1,2})\.?$/.exec(q)
  if (m) return valid(Number(today.slice(0, 4)), Number(m[1]), Number(m[2]))
  return null
}

/** Relative day name for today ± 1, else null. */
export function relativeDay(iso: string, today: string): 'today' | 'tomorrow' | 'yesterday' | null {
  if (iso === today) return 'today'
  if (iso === addDays(today, 1)) return 'tomorrow'
  if (iso === addDays(today, -1)) return 'yesterday'
  return null
}

/** Localized absolute date; the year is shown only when it isn't the current one. */
export function formatDate(iso: string, today: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const sameYear = String(y) === today.slice(0, 4)
  return new Intl.DateTimeFormat(locale, {
    year: sameYear ? undefined : 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(y, m - 1, d))
}
