import type { FieldOptions } from './types'

/**
 * Display formats and input parsing for field types (spec/05 §3.2). Pure: the locale is a
 * parameter (the UI passes the app language's `ko-KR` / `en-US`).
 */

export type NumberFormat = 'number' | 'percent' | 'currency'
export const CURRENCIES = ['KRW', 'USD', 'EUR', 'JPY', 'GBP', 'CNY'] as const

const nfCache = new Map<string, Intl.NumberFormat>()
function nf(locale: string, o: Intl.NumberFormatOptions) {
  const key = locale + JSON.stringify(o)
  let f = nfCache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(locale, o)
    nfCache.set(key, f)
  }
  return f
}

/** Number cell text: thousands separators, fixed decimals, percent (value 0.5 → 50%), currency. */
export function formatNumber(value: number, options: FieldOptions, locale: string): string {
  const decimals = typeof options.decimals === 'number' ? Math.max(0, Math.min(10, options.decimals)) : undefined
  const digits: Intl.NumberFormatOptions =
    decimals === undefined
      ? { maximumFractionDigits: 10 }
      : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
  const grouping = options.separator !== false
  switch (options.format) {
    case 'percent':
      return nf(locale, { style: 'percent', useGrouping: grouping, ...digits }).format(value)
    case 'currency': {
      const currency = typeof options.currency === 'string' ? options.currency : 'KRW'
      return nf(locale, {
        style: 'currency',
        currency,
        useGrouping: grouping,
        ...(decimals === undefined ? {} : digits),
      }).format(value)
    }
    default:
      return nf(locale, { useGrouping: grouping, ...digits }).format(value)
  }
}

/**
 * A typed or pasted number: tolerates separators, currency signs and spaces;
 * `50%` → 0.5 in percent fields. Returns null when there is no number.
 */
export function parseNumber(input: string, options: FieldOptions = {}): number | null {
  let s = input.trim()
  if (!s) return null
  const percent = s.endsWith('%')
  s = s.replace(/[%\s₩$€¥£,_]|\uc6d0/g, '')
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return percent || options.format === 'percent' ? n / 100 : n
}

/** `1h 30m`, `90m`, `1.5h`, `1:30`, `90` (minutes), Korean units (hours/minutes/days) → minutes. */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase()
  if (!s) return null
  const colon = /^(\d+):(\d{1,2})$/.exec(s)
  if (colon) return Number(colon[1]) * 60 + Number(colon[2])
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s))
  let total = 0
  let matched = false
  const re = /(\d+(?:\.\d+)?)\s*(hours|hour|hrs|hr|h|\uc2dc\uac04|minutes|minute|mins|min|m|\ubd84|days|day|d|\uc77c)/g
  let rest = s
  for (const m of s.matchAll(re)) {
    matched = true
    const n = Number(m[1])
    const unit = m[2]!
    total +=
      unit.startsWith('d') || unit === '\uc77c'
        ? n * 1440
        : unit.startsWith('h') || unit === '\uc2dc\uac04'
          ? n * 60
          : n
    rest = rest.replace(m[0], '')
  }
  return matched && rest.trim() === '' ? Math.round(total) : null
}

/** Normalises a URL typed into a url cell: adds https:// to bare domains. */
export function normalizeUrl(input: string): string {
  const s = input.trim()
  if (!s) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s
  if (/^[^\s/]+\.[^\s]+/.test(s)) return `https://${s}`
  return s
}

/** Safe to open: http(s) and mailto only. */
export const isOpenableUrl = (url: string) => /^(https?:|mailto:)/i.test(url)

/** Date/time with the locale (created/updated time, date cells until M4-06's formats). */
export function formatDateTime(ts: number, locale: string, withTime = true): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(ts)
}
