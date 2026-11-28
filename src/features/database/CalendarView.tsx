import { CalendarX2, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addField,
  asDate,
  cellOf,
  dayStart,
  daysBetween,
  defaultDateField,
  eventOf,
  isoWeek,
  layoutWeek,
  monthWeeks,
  orderedFields,
  setCell,
  shiftDateValue,
  updateDbView,
  type CalendarEvent,
  DEFAULT_CALENDAR,
  type FieldMeta,
} from '@/core/model/database'
import { Button, EmptyState, Overlay } from '@/ui'
import { useLayout } from '@/platform/layout'
import { blockTouchScroll } from './boardDrag'
import { useDayDrag } from './calendarDrag'
import { CardBody } from './CardBody'
import { dt } from './i18n'
import type { LayoutProps } from './layoutProps'
import { appLocale } from './locale'
import { newRow } from './rowActions'
import { useOpenRow } from './rowNav'
import type { DbSession } from './session'
import './calendar.css'

/** Bars shown per day before "+N more" (row height fixed in calendar.css). */
const LANES = 3

const isDateLike = (f: FieldMeta) => f.type === 'date' || f.type === 'createdTime' || f.type === 'updatedTime'

/**
 * Calendar layout (M5-06, spec/05 §6): a month of the view's date field. Range events
 * are bars across days (and weeks); a day shows three, then "+N". Double-click a day for
 * a new row on that date. Settings (date field, first day, weekends, week numbers) are in
 * the settings bar.
 */
export default function CalendarView({ session, state, title, readOnly }: LayoutProps) {
  const view = state.view
  const settings = view?.calendar ?? DEFAULT_CALENDAR
  const field = state.fields.find((f) => f.id === settings.dateFieldId && isDateLike(f)) ?? null
  const fallback = field ? null : defaultDateField(state.fields)
  useEffect(() => {
    if (!readOnly && view && fallback)
      updateDbView(state.docs, view.id, { calendar: { ...settings, dateFieldId: fallback.id } })
  }, [readOnly, view, fallback, settings, state.docs])
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return { y: now.getFullYear(), m: now.getMonth() }
  })
  const [today] = useState(() => dayStart(Date.now()))
  const setOpen = useOpenRow(view?.id)
  const [more, setMore] = useState<{ day: number; anchor: HTMLElement } | null>(null)
  const [selected, setSelected] = useState<number>(() => dayStart(Date.now()))
  const [noDateOpen, setNoDateOpen] = useState(false)
  const phone = useLayout().layout === 'phone'
  const editable = !readOnly && field?.type === 'date'
  const dayDrag = useDayDrag((rowId, from, to) => {
    if (!field || field.type !== 'date') return
    const row = session.row(rowId)
    const v = row ? asDate(cellOf(field, row)) : null
    // from the "no date" panel: that day; an event: moved by whole days (time and length kept)
    setCell(
      state.docs,
      rowId,
      field.id,
      v && from !== null ? shiftDateValue(v, daysBetween(from, to)) : { start: to, includeTime: false },
    )
  })
  const attach = useCallback((el: HTMLDivElement | null) => (el ? blockTouchScroll(el) : undefined), [])
  const primary = state.fields.find((f) => f.id === state.meta.primaryFieldId)
  const props = useMemo(
    () =>
      view
        ? orderedFields(state.fields, view).filter(
            (f) => f.id !== primary?.id && f.id !== field?.id && view.fields[f.id]?.visible !== false,
          )
        : [],
    [view, state.fields, primary, field],
  )
  // events of the visible rows (filter and sort applied)
  const events = useMemo(() => {
    if (!field) return []
    const out: CalendarEvent[] = []
    for (const id of state.result.rowIds) {
      const row = session.row(id)
      const e = row && eventOf(field, row)
      if (e) out.push(e)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rowsVersion invalidates row snapshots
  }, [field, state.result.rowIds, session, state.rowsVersion])
  const undated = useMemo(() => {
    if (!field) return []
    const dated = new Set(events.map((e) => e.id))
    return state.result.rowIds.filter((id) => !dated.has(id))
  }, [field, events, state.result.rowIds])

  if (!view) return null
  if (!field) {
    if (fallback) return null
    return (
      <EmptyState
        title={dt('db.cal.noDateField')}
        description={dt('db.cal.noDateFieldHint')}
        action={
          readOnly ? undefined : (
            <Button
              onClick={() => {
                const id = addField(state.docs, { name: dt('db.cal.dateField'), type: 'date' })
                updateDbView(state.docs, view.id, { calendar: { ...settings, dateFieldId: id } })
              }}
            >
              {dt('db.cal.createDate')}
            </Button>
          )
        }
      />
    )
  }
  const weeks = monthWeeks(month.y, month.m, settings.firstDayOfWeek)
  const shownDays = (week: number[]) =>
    settings.showWeekends ? week : week.filter((d) => new Date(d).getDay() % 6 !== 0)
  const locale = appLocale()
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const monthFmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' })
  const go = (delta: number) => {
    const d = new Date(month.y, month.m + delta, 1)
    setMonth({ y: d.getFullYear(), m: d.getMonth() })
  }
  const addOn = (day: number) => {
    if (!editable) return
    const id = newRow(state.docs, state.fields, view)
    setCell(state.docs, id, field.id, { start: day, includeTime: false })
    setOpen(id)
  }
  const titleOf = (id: string) => {
    const row = session.row(id)
    return (primary && row ? String(cellOf(primary, row) ?? '') : '') || dt('db.row.untitled')
  }
  const drag = dayDrag.drag
  const cols = shownDays(weeks[0]!).length
  const template = `${settings.showWeekNumbers ? '32px ' : ''}repeat(${cols}, minmax(0, 1fr))`
  return (
    <div ref={attach} className={`dbc${phone ? ' is-phone' : ''}`} aria-label={dt('db.cal.label', { title })}>
      <div className="dbc-nav">
        <h3 className="dbc-month" aria-live="polite">
          {monthFmt.format(new Date(month.y, month.m, 1))}
        </h3>
        <button type="button" className="db-icon-btn" aria-label={dt('db.cal.prev')} onClick={() => go(-1)}>
          <ChevronLeft size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="db-barbtn"
          onClick={() => setMonth({ y: new Date(today).getFullYear(), m: new Date(today).getMonth() })}
        >
          {dt('db.cal.today')}
        </button>
        <button type="button" className="db-icon-btn" aria-label={dt('db.cal.next')} onClick={() => go(1)}>
          <ChevronRight size={16} aria-hidden />
        </button>
        <button
          type="button"
          className={`db-barbtn dbc-nodate-btn${noDateOpen ? ' is-on' : ''}`}
          aria-expanded={noDateOpen}
          aria-label={dt('db.cal.noDate', { count: undated.length })}
          onClick={() => setNoDateOpen(!noDateOpen)}
        >
          <CalendarX2 size={14} aria-hidden />
          {phone ? undated.length : dt('db.cal.noDate', { count: undated.length })}
        </button>
        <input
          type="month"
          className="db-input dbc-picker"
          aria-label={dt('db.cal.pickMonth')}
          value={`${month.y}-${String(month.m + 1).padStart(2, '0')}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split('-').map(Number)
            if (y && m) setMonth({ y, m: m - 1 })
          }}
        />
      </div>
      <div className="dbc-grid" role="grid" aria-label={monthFmt.format(new Date(month.y, month.m, 1))}>
        <div className="dbc-weekdays" role="row" style={{ gridTemplateColumns: template }}>
          {settings.showWeekNumbers && <span role="columnheader" className="dbc-wn" />}
          {shownDays(weeks[0]!).map((d) => (
            <span key={d} role="columnheader" className="dbc-weekday">
              {weekdayFmt.format(new Date(d))}
            </span>
          ))}
        </div>
        {weeks.map((week) => {
          const days = shownDays(week)
          const bars = layoutWeek(events, days)
          return (
            <div key={week[0]} className="dbc-week" role="row" style={{ gridTemplateColumns: template }}>
              {settings.showWeekNumbers && (
                <span className="dbc-wn" title={dt('db.cal.weekNumber')}>
                  {isoWeek(week[0]!)}
                </span>
              )}
              {days.map((day) => {
                const hiddenCount = bars.filter((b) => b.lane >= LANES && cover(b, days, day)).length
                return (
                  <div
                    key={day}
                    role="gridcell"
                    data-day={day}
                    aria-selected={phone ? day === selected : undefined}
                    className={`dbc-day${new Date(day).getMonth() !== month.m ? ' is-other' : ''}${day === today ? ' is-today' : ''}${drag?.over === day ? ' is-drop' : ''}${phone && day === selected ? ' is-selected' : ''}`}
                    onClick={phone ? () => setSelected(day) : undefined}
                    onDoubleClick={(e) => {
                      if (phone) return
                      if ((e.target as HTMLElement).closest('.dbc-event')) return
                      addOn(day)
                    }}
                  >
                    <span className="dbc-date">{new Date(day).getDate()}</span>
                    {phone && <DayDots count={events.filter((e) => e.start <= day && e.end >= day).length} />}
                    {!phone && hiddenCount > 0 && (
                      <button
                        type="button"
                        className="dbc-more"
                        onClick={(e) => setMore({ day, anchor: e.currentTarget })}
                      >
                        {dt('db.cal.more', { count: hiddenCount })}
                      </button>
                    )}
                  </div>
                )
              })}
              <div className="dbc-bars" style={{ left: settings.showWeekNumbers ? 32 : 0 }}>
                {!phone &&
                  bars
                    .filter((b) => b.lane < LANES)
                    .map((b) => (
                      <EventBar
                        key={b.id}
                        session={session}
                        rowId={b.id}
                        primary={primary}
                        props={props}
                        style={{
                          left: `calc(${(b.col / cols) * 100}% + 2px)`,
                          width: `calc(${(b.span / cols) * 100}% - 4px)`,
                          top: 26 + b.lane * 24,
                        }}
                        before={b.before}
                        after={b.after}
                        dragging={drag?.rowId === b.id}
                        onPointerDown={editable ? (e) => dayDrag.start(e, b.id, false, titleOf(b.id)) : undefined}
                        onOpen={(id) => !dayDrag.wasDrag() && setOpen(id)}
                      />
                    ))}
              </div>
            </div>
          )
        })}
      </div>
      {phone && (
        <DayAgenda
          day={selected}
          events={events.filter((e) => e.start <= selected && e.end >= selected)}
          session={session}
          primary={primary}
          props={props}
          onOpen={setOpen}
          onAdd={editable ? () => addOn(selected) : undefined}
        />
      )}
      {noDateOpen && (
        <NoDatePanel
          ids={undated}
          phone={phone}
          titleOf={titleOf}
          selectedLabel={new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(new Date(selected))}
          onPointerDown={editable && !phone ? (e, id) => dayDrag.start(e, id, true, titleOf(id)) : undefined}
          onPlace={
            editable && phone
              ? (id) => setCell(state.docs, id, field.id, { start: selected, includeTime: false })
              : undefined
          }
          onOpen={(id) => !dayDrag.wasDrag() && setOpen(id)}
          onClose={() => setNoDateOpen(false)}
        />
      )}
      {drag?.over != null && (
        <div className="dbc-ghost" aria-hidden style={{ left: drag.x + 8, top: drag.y + 8 }}>
          {drag.label}
        </div>
      )}
      {more && (
        <DayList
          day={more.day}
          anchor={more.anchor}
          events={events.filter((e) => e.start <= more.day && e.end >= more.day)}
          session={session}
          primary={primary}
          onOpen={(id) => {
            setMore(null)
            setOpen(id)
          }}
          onClose={() => setMore(null)}
        />
      )}
    </div>
  )
}

const cover = (b: { col: number; span: number }, days: number[], day: number) => {
  const i = days.indexOf(day)
  return i >= b.col && i < b.col + b.span
}

function EventBar({
  session,
  rowId,
  primary,
  props,
  style,
  before,
  after,
  dragging,
  onPointerDown,
  onOpen,
}: {
  session: DbSession
  rowId: string
  primary: FieldMeta | undefined
  props: FieldMeta[]
  style: React.CSSProperties
  dragging: boolean
  onPointerDown: ((e: React.PointerEvent<HTMLElement>) => void) | undefined
  before: boolean
  after: boolean
  onOpen: (id: string) => void
}) {
  const row = session.row(rowId)
  if (!row) return null
  return (
    <button
      type="button"
      className={`dbc-event${before ? ' is-cont-before' : ''}${after ? ' is-cont-after' : ''}${dragging ? ' is-dragging' : ''}`}
      data-row-id={rowId}
      style={style}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => onPointerDown && e.preventDefault()}
      onClick={() => onOpen(rowId)}
    >
      <CardBody row={row} primary={primary} fields={props} labels={false} />
    </button>
  )
}

function DayList({
  day,
  anchor,
  events,
  session,
  primary,
  onOpen,
  onClose,
}: {
  day: number
  anchor: HTMLElement
  events: CalendarEvent[]
  session: DbSession
  primary: FieldMeta | undefined
  onOpen: (id: string) => void
  onClose: () => void
}) {
  const phone = useLayout().layout === 'phone'
  const label = new Intl.DateTimeFormat(appLocale(), { month: 'long', day: 'numeric', weekday: 'short' }).format(
    new Date(day),
  )
  return (
    <Overlay anchor={anchor} title={label} sheet={phone} onClose={onClose}>
      <div className="db-pop dbc-daylist">
        {events.map((e) => {
          const row = session.row(e.id)
          if (!row) return null
          return (
            <button key={e.id} type="button" className="dbc-event is-static" onClick={() => onOpen(e.id)}>
              <CardBody row={row} primary={primary} fields={[]} labels={false} />
            </button>
          )
        })}
      </div>
    </Overlay>
  )
}

/** Phone: up to three dots for the day's events (MB-33). */
function DayDots({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="dbc-dots" aria-label={dt('db.cal.events', { count })}>
      {Array.from({ length: Math.min(3, count) }, (_, i) => (
        <span key={i} className="dbc-dot" />
      ))}
    </span>
  )
}

/** Phone: the selected day's events under the month (AppFlowy mobile calendar, DB-C08). */
function DayAgenda({
  day,
  events,
  session,
  primary,
  props,
  onOpen,
  onAdd,
}: {
  day: number
  events: CalendarEvent[]
  session: DbSession
  primary: FieldMeta | undefined
  props: FieldMeta[]
  onOpen: (id: string) => void
  onAdd: (() => void) | undefined
}) {
  const label = new Intl.DateTimeFormat(appLocale(), { month: 'long', day: 'numeric', weekday: 'long' }).format(
    new Date(day),
  )
  return (
    <section className="dbc-agenda" aria-label={label}>
      <h4 className="dbc-agenda-title">{label}</h4>
      {!events.length && <p className="db-empty">{dt('db.cal.noEvents')}</p>}
      {events.map((e) => {
        const row = session.row(e.id)
        if (!row) return null
        return (
          <button key={e.id} type="button" className="db-card dbc-agenda-item" onClick={() => onOpen(e.id)}>
            <CardBody row={row} primary={primary} fields={props} labels={false} />
          </button>
        )
      })}
      {onAdd && (
        <button type="button" className="dbc-new" onClick={onAdd}>
          <Plus size={14} aria-hidden />
          {dt('db.board.new')}
        </button>
      )}
    </section>
  )
}

/**
 * Rows without a date (DB-C05): drag one onto a day (desktop), or on phones tap "place"
 * to give it the selected day.
 */
function NoDatePanel({
  ids,
  phone,
  titleOf,
  selectedLabel,
  onPointerDown,
  onPlace,
  onOpen,
  onClose,
}: {
  ids: string[]
  phone: boolean
  titleOf: (id: string) => string
  selectedLabel: string
  onPointerDown: ((e: React.PointerEvent<HTMLElement>, id: string) => void) | undefined
  onPlace: ((id: string) => void) | undefined
  onOpen: (id: string) => void
  onClose: () => void
}) {
  const list = (
    <div className="dbc-nodate-list">
      {!ids.length && <p className="db-empty">{dt('db.cal.allDated')}</p>}
      {ids.map((id) => (
        <div key={id} className="dbc-nodate-item">
          <button
            type="button"
            className="dbc-event is-static"
            data-row-id={id}
            onPointerDown={onPointerDown ? (e) => onPointerDown(e, id) : undefined}
            onClick={() => onOpen(id)}
          >
            <span className="db-card-title">{titleOf(id)}</span>
          </button>
          {onPlace && (
            <button type="button" className="db-option-create" onClick={() => onPlace(id)}>
              {dt('db.cal.placeOn', { date: selectedLabel })}
            </button>
          )}
        </div>
      ))}
    </div>
  )
  if (phone)
    return (
      <Overlay anchor={null} title={dt('db.cal.noDateTitle')} sheet onClose={onClose}>
        <div className="db-pop">{list}</div>
      </Overlay>
    )
  return (
    <aside className="dbc-nodate" aria-label={dt('db.cal.noDateTitle')}>
      <div className="dbk-side-title">{dt('db.cal.noDateHint')}</div>
      {list}
    </aside>
  )
}
