import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import {
  asDate,
  DATE_FORMATS,
  formatDay,
  setCell,
  setFieldOptions,
  type DateValue,
  type DbDocs,
  type FieldMeta,
} from '@/core/model/database'
import { Switch } from '@/ui'
import { dt, type DbKey } from './i18n'
import { appLocale } from './locale'

const DAY = 86_400_000
const startOfDay = (ts: number) => new Date(ts).setHours(0, 0, 0, 0)
const sameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b)
const pad = (n: number) => String(n).padStart(2, '0')
const timeOf = (ts: number) => `${pad(new Date(ts).getHours())}:${pad(new Date(ts).getMinutes())}`
/** `day` (local midnight) at the time of day of `withTimeOf`. */
function atTime(day: number, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(day)
  d.setHours(h || 0, m || 0, 0, 0)
  return d.getTime()
}

/**
 * Calendar popover for date cells (spec/05 §3.2): pick a day, optional end date and time,
 * the field's date/time formats, clear. Writes straight to the row.
 */
export function DateEditor({
  docs,
  field,
  rowId,
  value,
  readOnly,
  weekStart = 0,
}: {
  docs: DbDocs
  field: FieldMeta
  rowId: string
  value: unknown
  readOnly: boolean
  weekStart?: 0 | 1
}) {
  const v = asDate(value)
  const [today] = useState(() => Date.now())
  const [month, setMonth] = useState(() => {
    const d = new Date(v?.start ?? Date.now())
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  })
  // with an end date, clicks alternate between start and end
  const [picking, setPicking] = useState<'start' | 'end'>('start')
  const locale = appLocale()
  const write = (next: DateValue | null) => !readOnly && setCell(docs, rowId, field.id, next)
  const hasEnd = v?.end !== undefined

  const pick = (day: number) => {
    const t = (base: number | undefined) => (v?.includeTime && base !== undefined ? timeOf(base) : '00:00')
    if (!v) return write({ start: day, includeTime: false })
    if (hasEnd && picking === 'end') {
      const end = atTime(day, t(v.end))
      write(end < v.start ? { ...v, start: end, end: v.start } : { ...v, end })
      setPicking('start')
    } else {
      const start = atTime(day, t(v.start))
      write(hasEnd && start > v.end! ? { ...v, start: v.end!, end: start } : { ...v, start })
      if (hasEnd) setPicking('end')
    }
  }

  const first = new Date(month)
  const lead = (first.getDay() - weekStart + 7) % 7
  const days = Array.from({ length: 42 }, (_, i) =>
    new Date(first.getFullYear(), first.getMonth(), i - lead + 1).getTime(),
  )
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2026, 10, 1 + ((i + weekStart) % 7))),
  )
  const inRange = (d: number) => v && hasEnd && d >= startOfDay(v.start) && d <= startOfDay(v.end!)

  return (
    <div className="db-date">
      {v && (
        <div className="db-date-values">
          <button
            type="button"
            className={`db-date-value${picking === 'start' ? ' is-picking' : ''}`}
            onClick={() => setPicking('start')}
          >
            {formatDay(v.start, field.options, locale, v.includeTime)}
          </button>
          {hasEnd && (
            <button
              type="button"
              className={`db-date-value${picking === 'end' ? ' is-picking' : ''}`}
              onClick={() => setPicking('end')}
            >
              {formatDay(v.end!, field.options, locale, v.includeTime)}
            </button>
          )}
        </div>
      )}
      {v?.includeTime && !readOnly && (
        <div className="db-date-times">
          <label>
            {dt('db.date.start')}
            <input
              type="time"
              className="db-input"
              value={timeOf(v.start)}
              onChange={(e) => write({ ...v, start: atTime(startOfDay(v.start), e.target.value) })}
            />
          </label>
          {hasEnd && (
            <label>
              {dt('db.date.endLabel')}
              <input
                type="time"
                className="db-input"
                value={timeOf(v.end!)}
                onChange={(e) => write({ ...v, end: atTime(startOfDay(v.end!), e.target.value) })}
              />
            </label>
          )}
        </div>
      )}
      <div className="db-cal-head">
        <button
          type="button"
          className="db-icon-btn"
          aria-label={dt('db.date.prev')}
          onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() - 1, 1).getTime())}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        <span className="db-cal-title" aria-live="polite">
          {new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(first)}
        </span>
        <button
          type="button"
          className="db-icon-btn"
          aria-label={dt('db.date.next')}
          onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() + 1, 1).getTime())}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      <div className="db-cal" role="grid">
        {weekdays.map((w, i) => (
          <span key={i} className="db-cal-wd" aria-hidden>
            {w}
          </span>
        ))}
        {days.map((d) => {
          const selected = v && (sameDay(d, v.start) || (hasEnd && sameDay(d, v.end!)))
          return (
            <button
              key={d}
              type="button"
              disabled={readOnly}
              aria-pressed={!!selected}
              aria-label={new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(d)}
              className={`db-cal-day${new Date(d).getMonth() !== first.getMonth() ? ' is-other' : ''}${
                sameDay(d, today) ? ' is-today' : ''
              }${selected ? ' is-selected' : ''}${inRange(d) ? ' is-range' : ''}`}
              onClick={() => pick(d)}
            >
              {new Date(d).getDate()}
            </button>
          )
        })}
      </div>
      {!readOnly && (
        <div className="db-date-options">
          <Switch
            checked={hasEnd}
            label={dt('db.date.end')}
            onChange={(on) => {
              const base = v ?? { start: startOfDay(Date.now()), includeTime: false }
              if (on) {
                write({ ...base, end: base.start + DAY })
                setPicking('end')
              } else {
                const rest = { ...base }
                delete rest.end
                write(rest)
                setPicking('start')
              }
            }}
          />
          <Switch
            checked={!!v?.includeTime}
            label={dt('db.date.time')}
            onChange={(on) => {
              const base = v ?? { start: startOfDay(Date.now()), includeTime: false }
              write(
                on
                  ? { ...base, includeTime: true, start: atTime(startOfDay(base.start), '09:00') }
                  : {
                      ...base,
                      includeTime: false,
                      start: startOfDay(base.start),
                      ...(base.end !== undefined ? { end: startOfDay(base.end) } : {}),
                    },
              )
            }}
          />
          <label className="db-date-select">
            {dt('db.date.format')}
            <select
              value={field.options.dateFormat ?? 'friendly'}
              onChange={(e) => setFieldOptions(docs, field.id, { dateFormat: e.target.value })}
            >
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {dt(`db.date.fmt.${f}` as DbKey)}
                </option>
              ))}
            </select>
          </label>
          <label className="db-date-select">
            {dt('db.date.timeFormat')}
            <select
              value={field.options.timeFormat ?? '24'}
              onChange={(e) => setFieldOptions(docs, field.id, { timeFormat: e.target.value as '12' | '24' })}
            >
              <option value="24">{dt('db.date.h24')}</option>
              <option value="12">{dt('db.date.h12')}</option>
            </select>
          </label>
          <button type="button" className="db-option-create" onClick={() => write(null)} disabled={!v}>
            {dt('db.date.clear')}
          </button>
        </div>
      )}
    </div>
  )
}
