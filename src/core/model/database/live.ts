import { calculate, compileQuery, groupsOf, type CompiledQuery, type QueryInput, type QueryResult } from './query'
import type { RowSnapshot } from './types'

/**
 * Incremental query (spec/05 §2): keeps the filtered, sorted rows and, when rows change,
 * re-evaluates only those rows — the filter decides whether they stay, a binary search
 * finds their place. Settings changes (`setQuery`) recompute everything. The result is
 * always the same as `runQuery` over the current rows (property test).
 */
export interface LiveQuery {
  /** Rows changed or were added (`upserts`) and removed (`deletes`). */
  apply(change: { upserts?: RowSnapshot[]; deletes?: string[] }): void
  /** New fields / view settings / search / now: full recompute. */
  setQuery(input: Omit<QueryInput, 'rows'>): void
  result(): QueryResult
  rowCount(): number
}

export function createLiveQuery(input: QueryInput): LiveQuery {
  let query: Omit<QueryInput, 'rows'> = input
  let compiled: CompiledQuery = compileQuery(query)
  const rows = new Map<string, RowSnapshot>(input.rows.map((r) => [r.id, r]))
  let visible: RowSnapshot[] = []
  let cached: QueryResult | null = null

  const recompute = () => {
    visible = [...rows.values()].filter(compiled.matches).sort(compiled.compare)
    cached = null
  }

  /** First index whose row sorts at or after `row`. */
  const lowerBound = (row: RowSnapshot) => {
    let lo = 0
    let hi = visible.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (compiled.compare(visible[mid]!, row) < 0) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  const remove = (old: RowSnapshot) => {
    const i = lowerBound(old)
    if (visible[i]?.id === old.id) visible.splice(i, 1)
    else {
      // not where its old values put it (should not happen): fall back to a scan
      const j = visible.findIndex((r) => r.id === old.id)
      if (j >= 0) visible.splice(j, 1)
    }
  }

  recompute()
  return {
    apply({ upserts = [], deletes = [] }) {
      for (const id of deletes) {
        const old = rows.get(id)
        if (!old) continue
        rows.delete(id)
        if (compiled.matches(old)) remove(old)
      }
      for (const row of upserts) {
        const old = rows.get(row.id)
        if (old && compiled.matches(old)) remove(old)
        rows.set(row.id, row)
        if (compiled.matches(row)) visible.splice(lowerBound(row), 0, row)
      }
      if (upserts.length || deletes.length) cached = null
    },
    setQuery(next) {
      query = next
      compiled = compileQuery(query)
      recompute()
    },
    result() {
      if (cached) return cached
      const calcs: QueryResult['calcs'] = {}
      const fields = new Map(query.fields.map((f) => [f.id, f]))
      for (const [fieldId, calc] of Object.entries(query.view.calcs ?? {})) {
        const field = fields.get(fieldId)
        if (field) calcs[fieldId] = calculate(calc, field, visible, query.derived?.[fieldId])
      }
      cached = { rowIds: visible.map((r) => r.id), calcs, ...groupsOf(query, visible) }
      return cached
    },
    rowCount: () => rows.size,
  }
}
