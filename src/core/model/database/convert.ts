import { newId } from '../views'
import { asChecklist, asDate, asMedia, asNumber, asText, cellText, choicesOf, selectedIds } from './cells'
import { nextColor } from './choices'
import { parseDate, parseNumber } from './format'
import { getField, readDbMeta, rowsOf, PrimaryFieldError, type DbDocs } from './model'
import { assertWritable } from '../guard'
import * as Y from 'yjs'
import type { CellValue, FieldMeta, FieldType, SelectChoice } from './types'

/**
 * Field type conversion (spec/05 §3.4). `convertValue` is the per-cell rule; a value the
 * new type cannot hold becomes empty and counts as lost (the UI asks first: "N cells").
 */

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', '✓', '✔', 'x', 'on', 'checked'])
const COMPUTED: ReadonlySet<FieldType> = new Set(['createdTime', 'updatedTime', 'rollup'])

const emptyValue = (v: unknown) =>
  v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && v.length === 0)

/**
 * The new cell value. `choices` (select targets) is the option list being built: new
 * options are appended to it. Returns undefined for "no value".
 */
export function convertValue(
  from: FieldMeta,
  to: FieldType,
  v: unknown,
  choices: SelectChoice[],
): CellValue | undefined {
  if (from.type === to) return v as CellValue
  if (emptyValue(v) && from.type !== 'createdTime' && from.type !== 'updatedTime') return undefined
  const text = () => (from.type === 'checkbox' ? (v === true ? 'true' : '') : cellText(from, v))
  const option = (name: string) => {
    const n = name.trim()
    if (!n) return null
    let c = choices.find((x) => x.name === n)
    if (!c) {
      c = { id: newId(), name: n, color: nextColor(choices) }
      choices.push(c)
    }
    return c.id
  }
  switch (to) {
    case 'text':
      return text() || undefined
    case 'url':
      return from.type === 'text' ? asText(v).trim() || undefined : text() || undefined
    case 'number':
      if (from.type === 'time') return asNumber(v) ?? undefined
      if (from.type === 'text' || from.type === 'url') {
        const s = asText(v)
        return parseNumber(s) ?? (Number.isFinite(parseFloat(s)) ? parseFloat(s) : undefined)
      }
      return undefined
    case 'time':
      return from.type === 'number' ? (asNumber(v) ?? undefined) : undefined
    case 'select':
    case 'multiSelect': {
      if (from.type === 'select' || from.type === 'multiSelect') {
        const ids = selectedIds(from, v)
        for (const id of ids)
          if (!choices.some((c) => c.id === id)) choices.push(choicesOf(from).find((c) => c.id === id)!)
        return to === 'select' ? (ids[0] ?? undefined) : ids.length ? ids : undefined
      }
      if (from.type !== 'text' && from.type !== 'url') return undefined
      const s = asText(v)
      if (to === 'select') return option(s) ?? undefined
      const ids = [
        ...new Set(
          s
            .split(',')
            .map(option)
            .filter((x): x is string => !!x),
        ),
      ]
      return ids.length ? ids : undefined
    }
    case 'date': {
      if (from.type === 'createdTime' || from.type === 'updatedTime') {
        const n = asNumber(v)
        return n === null ? undefined : { start: n, includeTime: true }
      }
      if (from.type === 'text' || from.type === 'url') return parseDate(asText(v)) ?? undefined
      if (from.type === 'number') return parseDate(asNumber(v) ?? NaN) ?? undefined
      return undefined
    }
    case 'checkbox':
      if (from.type === 'text' || from.type === 'url')
        return TRUE_WORDS.has(asText(v).trim().toLowerCase()) || undefined
      return undefined
    default:
      return undefined
  }
}

/** Was something lost: the old value was non-empty and the new one is empty? */
function lost(from: FieldMeta, v: unknown, out: CellValue | undefined): boolean {
  if (from.type === 'checkbox') return v === true && out === undefined
  if (out !== undefined) return false
  if (from.type === 'date') return asDate(v) !== null
  if (from.type === 'checklist') return asChecklist(v).length > 0
  if (from.type === 'media') return asMedia(v).length > 0
  if (from.type === 'select' || from.type === 'multiSelect') return selectedIds(from, v).length > 0
  return !emptyValue(v)
}

export interface ConversionPlan {
  /** Cells whose value disappears (ask before converting). */
  lostCount: number
  /** Option list of a select target after conversion. */
  choices: SelectChoice[]
  cells: Map<string, CellValue | undefined>
}

/** What converting `fieldId` to `to` would do, without changing anything. */
export function planConversion(db: DbDocs, fieldId: string, to: FieldType): ConversionPlan {
  const field = getField(db, fieldId)
  const plan: ConversionPlan = { lostCount: 0, choices: [], cells: new Map() }
  if (!field) return plan
  // select ↔ multi-select keep every option, used or not
  if ((to === 'select' || to === 'multiSelect') && (field.type === 'select' || field.type === 'multiSelect'))
    plan.choices = [...choicesOf(field)]
  const computedFrom = field.type === 'createdTime' || field.type === 'updatedTime'
  for (const shard of db.shards)
    rowsOf(shard).forEach((rm, rowId) => {
      const cells = rm.get('cells')
      const stored = cells instanceof Y.Map ? cells.get(fieldId) : undefined
      const v = computedFrom ? rm.get(field.type === 'createdTime' ? 'createdAt' : 'updatedAt') : stored
      const out = COMPUTED.has(to) ? undefined : convertValue(field, to, v, plan.choices)
      if (!computedFrom && lost(field, v, out)) plan.lostCount++
      if (computedFrom ? out !== undefined : JSON.stringify(out ?? null) !== JSON.stringify(stored ?? null))
        plan.cells.set(rowId, out)
    })
  return plan
}

/**
 * Converts a field's type and every cell (spec/05 §3.4). Returns `undo`, which puts the
 * old type, options and values back — except cells edited after the conversion. The UI
 * offers it for 30 seconds.
 */
export function convertField(db: DbDocs, fieldId: string, to: FieldType): (() => void) | null {
  assertWritable()
  if (fieldId === readDbMeta(db).primaryFieldId) throw new PrimaryFieldError()
  const field = getField(db, fieldId)
  if (!field || field.type === to) return null
  const plan = planConversion(db, fieldId, to)
  const before = new Map<string, CellValue | undefined>()
  const fm = db.schema.getMap<Y.Map<unknown>>('fields').get(fieldId)!
  const opts = fm.get('options') as Y.Map<unknown>
  const oldChoices = opts.get('choices')
  db.schema.transact(() => {
    fm.set('type', to)
    if (to === 'select' || to === 'multiSelect') opts.set('choices', plan.choices)
  })
  for (const shard of db.shards)
    shard.transact(() =>
      rowsOf(shard).forEach((rm, rowId) => {
        if (!plan.cells.has(rowId)) return
        const cells = rm.get('cells') as Y.Map<unknown>
        before.set(rowId, cells.get(fieldId) as CellValue | undefined)
        const v = plan.cells.get(rowId)
        if (v === undefined) cells.delete(fieldId)
        else cells.set(fieldId, v)
      }),
    )
  return () => {
    assertWritable()
    db.schema.transact(() => {
      fm.set('type', field.type)
      if (oldChoices === undefined) opts.delete('choices')
      else opts.set('choices', oldChoices)
    })
    for (const shard of db.shards)
      shard.transact(() =>
        rowsOf(shard).forEach((rm, rowId) => {
          if (!before.has(rowId)) return
          const cells = rm.get('cells') as Y.Map<unknown>
          const now = cells.get(fieldId)
          if (JSON.stringify(now ?? null) !== JSON.stringify(plan.cells.get(rowId) ?? null)) return // edited since
          const old = before.get(rowId)
          if (old === undefined) cells.delete(fieldId)
          else cells.set(fieldId, old)
        }),
      )
  }
}
