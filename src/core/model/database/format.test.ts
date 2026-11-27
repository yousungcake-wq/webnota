import { describe, expect, it } from 'vitest'
import { formatNumber, normalizeUrl, parseDuration, parseNumber, isOpenableUrl, formatDateTime } from './format'

describe('number format (spec/05 §3.2)', () => {
  it('formats plain, decimals, separators, percent and currencies', () => {
    expect(formatNumber(1234567.5, {}, 'ko-KR')).toBe('1,234,567.5')
    expect(formatNumber(1234.5, { decimals: 2 }, 'en-US')).toBe('1,234.50')
    expect(formatNumber(1234.5, { decimals: 0, separator: false }, 'en-US')).toBe('1235')
    expect(formatNumber(0.256, { format: 'percent', decimals: 1 }, 'en-US')).toBe('25.6%')
    expect(formatNumber(15000, { format: 'currency', currency: 'KRW' }, 'ko-KR')).toBe('₩15,000')
    expect(formatNumber(9.5, { format: 'currency', currency: 'USD' }, 'en-US')).toBe('$9.50')
    expect(formatNumber(9.5, { format: 'currency', currency: 'EUR' }, 'en-US')).toBe('€9.50')
    expect(formatNumber(1200, { format: 'currency', currency: 'JPY' }, 'en-US')).toBe('¥1,200')
  })
  it('parses typed and pasted numbers', () => {
    expect(parseNumber('1,234.5')).toBe(1234.5)
    expect(parseNumber(' -3 ')).toBe(-3)
    expect(parseNumber('₩15,000')).toBe(15000)
    expect(parseNumber('15,000원')).toBe(15000)
    expect(parseNumber('$9.50')).toBe(9.5)
    expect(parseNumber('50%')).toBe(0.5)
    expect(parseNumber('25', { format: 'percent' })).toBe(0.25)
    expect(parseNumber('.5')).toBe(0.5)
    expect(parseNumber('1e3')).toBe(1000)
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('1.2.3')).toBeNull()
    expect(parseNumber('')).toBeNull()
  })
})

describe('time (duration) field', () => {
  it('parses durations to minutes', () => {
    expect(parseDuration('1h 30m')).toBe(90)
    expect(parseDuration('90')).toBe(90)
    expect(parseDuration('1:05')).toBe(65)
    expect(parseDuration('1.5h')).toBe(90)
    expect(parseDuration('2시간 10분')).toBe(130)
    expect(parseDuration('1d')).toBe(1440)
    expect(parseDuration('45 min')).toBe(45)
    expect(parseDuration('soon')).toBeNull()
    expect(parseDuration('1h later')).toBeNull()
  })
})

describe('url', () => {
  it('adds https to bare domains and only opens safe schemes', () => {
    expect(normalizeUrl('example.com/a')).toBe('https://example.com/a')
    expect(normalizeUrl('http://x.y')).toBe('http://x.y')
    expect(normalizeUrl('just words')).toBe('just words')
    expect(isOpenableUrl('https://a.b')).toBe(true)
    expect(isOpenableUrl('javascript:alert(1)')).toBe(false)
  })
  it('formats date-times with the locale', () => {
    expect(formatDateTime(new Date(2026, 10, 27, 15, 4).getTime(), 'en-US')).toMatch(/Nov 27, 2026.*3:04/)
  })
})

describe('date format and parsing', () => {
  const ts = new Date(2026, 10, 7, 9, 5).getTime()
  it('formats in each date format, with 12/24h time and ranges', async () => {
    const { formatDay, formatDateValue } = await import('./format')
    expect(formatDay(ts, { dateFormat: 'iso' }, 'en-US', false)).toBe('2026-11-07')
    expect(formatDay(ts, { dateFormat: 'us' }, 'en-US', false)).toBe('11/07/2026')
    expect(formatDay(ts, { dateFormat: 'eu' }, 'en-US', false)).toBe('07/11/2026')
    expect(formatDay(ts, {}, 'en-US', false)).toBe('Nov 7, 2026')
    expect(formatDay(ts, {}, 'ko-KR', false)).toBe('2026년 11월 7일')
    expect(formatDay(ts, { dateFormat: 'iso' }, 'en-US', true)).toBe('2026-11-07 09:05')
    expect(formatDay(ts, { dateFormat: 'iso', timeFormat: '12' }, 'en-US', true)).toBe('2026-11-07 9:05 AM')
    expect(
      formatDateValue({ start: ts, end: ts + 86_400_000, includeTime: false }, { dateFormat: 'iso' }, 'en-US'),
    ).toBe('2026-11-07 → 2026-11-08')
  })
  it('parses ISO, dotted and slashed dates', async () => {
    const { parseDate } = await import('./format')
    expect(parseDate('2026-11-07')).toEqual({ start: new Date(2026, 10, 7).getTime(), includeTime: false })
    expect(parseDate('2026.11.07')).toEqual({ start: new Date(2026, 10, 7).getTime(), includeTime: false })
    expect(parseDate('2026. 11. 7.')).toEqual({ start: new Date(2026, 10, 7).getTime(), includeTime: false })
    expect(parseDate('2026/1/2 13:30')).toEqual({ start: new Date(2026, 0, 2, 13, 30).getTime(), includeTime: true })
    expect(parseDate('2026-02-31')).toBeNull()
    expect(parseDate('tomorrow')).toBeNull()
  })
})
