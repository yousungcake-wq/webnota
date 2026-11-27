import { Check, Square } from 'lucide-react'
import { choicesOf, dateOfGroupKey, formatDay, NO_VALUE, type FieldMeta } from '@/core/model/database'
import { Chip } from './Chip'
import { dt } from './i18n'
import { appLocale } from './locale'

/** Name of a board column / group (M5-03): option chip, check state, date period or address. */
export function GroupLabel({ field, groupKey }: { field: FieldMeta; groupKey: string }) {
  return <span className="db-group-label">{groupContent(field, groupKey)}</span>
}

/** Plain-text name of a group (menus, aria labels). */
export function groupName(field: FieldMeta, key: string): string {
  if (key === NO_VALUE) return dt('db.board.noValue', { field: field.name })
  if (field.type === 'select' || field.type === 'multiSelect')
    return choicesOf(field).find((c) => c.id === key)?.name ?? key
  if (field.type === 'checkbox') return key === 'true' ? dt('db.board.checked') : dt('db.board.unchecked')
  if (field.type === 'date') return dateGroupName(key)
  return key
}

function dateGroupName(key: string): string {
  const ts = dateOfGroupKey(key)
  if (ts === null) return key
  const locale = appLocale()
  const d = new Date(ts)
  switch (key[0]) {
    case 'y':
      return new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(d)
    case 'm':
      return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(d)
    case 'w':
      return dt('db.board.weekOf', { date: formatDay(ts, {}, locale, false) })
    default:
      return formatDay(ts, {}, locale, false)
  }
}

function groupContent(field: FieldMeta, key: string) {
  if (key !== NO_VALUE && (field.type === 'select' || field.type === 'multiSelect')) {
    const c = choicesOf(field).find((x) => x.id === key)
    if (c) return <Chip choice={c} />
  }
  if (field.type === 'checkbox')
    return (
      <>
        {key === 'true' ? <Check size={14} aria-hidden /> : <Square size={14} aria-hidden />}
        {groupName(field, key)}
      </>
    )
  return <span className={key === NO_VALUE ? 'db-group-none' : undefined}>{groupName(field, key)}</span>
}
