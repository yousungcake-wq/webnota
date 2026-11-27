import { useState } from 'react'
import {
  calcsFor,
  formatDay,
  formatMinutes,
  formatNumber,
  setCalc,
  type CalcResult,
  type CalcType,
  type DbDocs,
  type FieldMeta,
} from '@/core/model/database'
import { Menu } from '@/ui'
import { GUTTER, renderedColumns, type Column } from './gridColumns'
import { dt, type DbKey } from './i18n'
import { appLocale } from './locale'

const PERCENT = new Set<CalcType>(['percentEmpty', 'percentNotEmpty', 'percentChecked'])
const COUNTS = new Set<CalcType>(['count', 'countEmpty', 'countNotEmpty', 'countChecked', 'countUnchecked'])
const DAY = 86_400_000

/** A calculation result in the field's own format (spec/02 §4.4). */
export function formatCalc(field: FieldMeta, r: CalcResult): string {
  if (r.value === null) return '–'
  const locale = appLocale()
  if (PERCENT.has(r.calc)) return `${Math.round(r.value * 10) / 10}%`
  if (COUNTS.has(r.calc)) return formatNumber(r.value, {}, locale)
  if (field.type === 'time') return formatMinutes(r.value)
  if (field.type === 'date' || field.type === 'createdTime' || field.type === 'updatedTime')
    return r.calc === 'range'
      ? dt('db.calc.days', { count: Math.round(r.value / DAY) })
      : formatDay(r.value, field.options, locale, false)
  return formatNumber(
    r.value,
    r.calc === 'average' ? { ...field.options, decimals: field.options.decimals ?? 2 } : field.options,
    locale,
  )
}

/** Calculation row under the columns (DB-G06): pick a calculation per column. */
export function CalcRow({
  docs,
  viewId,
  columns,
  colRange,
  calcs,
  results,
  readOnly,
}: {
  docs: DbDocs
  viewId: string
  columns: Column[]
  colRange: { from: number; to: number }
  calcs: Record<string, CalcType>
  results: Record<string, CalcResult>
  readOnly: boolean
}) {
  const [menu, setMenu] = useState<{ field: FieldMeta; anchor: HTMLElement } | null>(null)
  const { frozen, shown, before, after } = renderedColumns(columns, colRange)
  const totalWidth = GUTTER + columns.reduce((n, c) => n + c.width, 0)
  const cell = (c: Column) => {
    const calc = calcs[c.field.id]
    const r = results[c.field.id]
    return (
      <button
        key={c.field.id}
        type="button"
        className={`dbg-calc${c.frozen ? ' is-frozen' : ''}`}
        data-field-id={c.field.id}
        style={{ width: c.width, left: c.frozen ? c.left + GUTTER : undefined }}
        disabled={readOnly}
        aria-label={`${c.field.name}: ${calc ? dt(`db.calc.${calc}` as DbKey) : dt('db.calc.label')}`}
        onClick={(e) => setMenu({ field: c.field, anchor: e.currentTarget })}
      >
        {calc && r ? (
          <>
            <span className="dbg-calc-label">{dt(`db.calc.${calc}` as DbKey)}</span>
            <span className="dbg-calc-value">{formatCalc(c.field, r)}</span>
          </>
        ) : (
          <span className="dbg-calc-label is-hint">{dt('db.calc.label')}</span>
        )}
      </button>
    )
  }
  return (
    <div className="dbg-calcrow" style={{ width: totalWidth }}>
      <div className="dbg-gutter" style={{ width: GUTTER }} />
      {frozen.map(cell)}
      {before > 0 && <div className="dbg-spacer" style={{ width: before }} />}
      {shown.map(cell)}
      {after > 0 && <div className="dbg-spacer" style={{ width: after }} />}
      <div className="dbg-fill" />
      {menu && (
        <Menu
          anchor={menu.anchor}
          title={dt('db.calc.label')}
          onClose={() => setMenu(null)}
          items={[
            {
              label: dt('db.calc.none'),
              checked: !calcs[menu.field.id],
              onSelect: () => setCalc(docs, viewId, menu.field.id, null),
            },
            ...calcsFor(menu.field).map((calc) => ({
              label: dt(`db.calc.${calc}` as DbKey),
              checked: calcs[menu.field.id] === calc,
              onSelect: () => setCalc(docs, viewId, menu.field.id, calc),
            })),
          ]}
        />
      )}
    </div>
  )
}
