import { cellOf, cellText } from './cells'
import { getField, getRow, readDbMeta, type DbDocs } from './model'
import { calcsFor, calculate, type CalcResult } from './query'
import { liveRelationIds } from './relation'
import type { CalcType, FieldMeta, RowSnapshot } from './types'

/**
 * Rollups (M6-04, spec/05 §10, P2): a read-only field computed from the rows a relation
 * links to — a relation field of this database, a field of its target, and a function:
 * the original values, the distinct values, or any calculation of the target field's type
 * (spec/02 §4.4). Nothing is stored in cells.
 */
export type RollupFn = CalcType | 'showOriginal' | 'unique'

export interface RollupOptions {
  relationFieldId: string | null
  targetFieldId: string | null
  fn: RollupFn
}

export function rollupOptions(field: FieldMeta): RollupOptions {
  const o = field.options
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  return {
    relationFieldId: str(o.relationFieldId),
    targetFieldId: str(o.targetFieldId),
    fn: (str(o.fn) as RollupFn | null) ?? 'showOriginal',
  }
}

/** Functions a rollup over `target` can use. */
export const rollupFns = (target: FieldMeta): RollupFn[] => ['showOriginal', 'unique', ...calcsFor(target)]

export type RollupValue =
  { kind: 'calc'; result: CalcResult; field: FieldMeta } | { kind: 'list'; items: string[] } | null

/** The relation field a rollup reads, if it still exists and is a relation. */
export function rollupRelation(field: FieldMeta, fields: FieldMeta[]): FieldMeta | null {
  const id = rollupOptions(field).relationFieldId
  const f = fields.find((x) => x.id === id)
  return f && f.type === 'relation' ? f : null
}

/**
 * The rollup of one row. `target` is the docs of the relation's target database (null
 * while loading); a missing target field falls back to the target's title.
 */
export function computeRollup(
  field: FieldMeta,
  row: RowSnapshot,
  fields: FieldMeta[],
  target: DbDocs | null,
): RollupValue {
  const relation = rollupRelation(field, fields)
  if (!relation || !target) return null
  const o = rollupOptions(field)
  const targetField =
    (o.targetFieldId && getField(target, o.targetFieldId)) || getField(target, readDbMeta(target).primaryFieldId)
  if (!targetField) return null
  const rows = liveRelationIds(relation, row, (id) => !!getRow(target, id)).map((id) => getRow(target, id)!)
  if (o.fn === 'showOriginal' || o.fn === 'unique') {
    const items = rows.map((r) => cellText(targetField, cellOf(targetField, r))).filter(Boolean)
    return { kind: 'list', items: o.fn === 'unique' ? [...new Set(items)] : items }
  }
  if (!calcsFor(targetField).includes(o.fn)) return null
  return { kind: 'calc', result: calculate(o.fn, targetField, rows), field: targetField }
}
