import { describe, expect, it } from 'vitest'
import { addDays, formatDate, parseDateQuery, relativeDay } from './dates'

const today = '2026-11-26'

describe('parseDateQuery', () => {
  it('understands relative words in both languages', () => {
    const ko = { 오늘: 0, 내일: 1, 어제: -1 }
    expect(parseDateQuery('오늘', today, ko)).toBe(today)
    expect(parseDateQuery('Tomorrow', today, ko)).toBe('2026-11-27')
    expect(parseDateQuery('어제', today, ko)).toBe('2026-11-25')
  })
  it('parses full and short dates', () => {
    expect(parseDateQuery('2026-12-01', today)).toBe('2026-12-01')
    expect(parseDateQuery('2027.1.5', today)).toBe('2027-01-05')
    expect(parseDateQuery('12/1', today)).toBe('2026-12-01')
  })
  it('rejects invalid dates and other text', () => {
    expect(parseDateQuery('2026-02-30', today)).toBeNull()
    expect(parseDateQuery('meeting', today)).toBeNull()
    expect(parseDateQuery('', today)).toBeNull()
  })
})

describe('day helpers', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('names today ± 1', () => {
    expect(relativeDay(today, today)).toBe('today')
    expect(relativeDay('2026-11-27', today)).toBe('tomorrow')
    expect(relativeDay('2026-11-28', today)).toBeNull()
  })
  it('shows the year only for other years', () => {
    expect(formatDate('2026-12-01', today, 'en-US')).not.toMatch(/2026/)
    expect(formatDate('2027-12-01', today, 'en-US')).toMatch(/2027/)
  })
})
