import {
  createLiveQuery,
  type LiveQuery,
  type QueryInput,
  type QueryResult,
  type RowSnapshot,
} from '@/core/model/database'

/** Messages to the query worker (spec/05 §2: rows are sent once, then only changes). */
export type ToWorker =
  | { type: 'init'; seq: number; input: QueryInput }
  | { type: 'apply'; seq: number; upserts: RowSnapshot[]; deletes: string[] }
  | { type: 'query'; seq: number; input: Omit<QueryInput, 'rows'> }
export interface FromWorker {
  type: 'result'
  seq: number
  result: QueryResult
}

/** The worker's state machine, separate from `self` so it is unit-testable. */
export function createWorkerHandler(post: (m: FromWorker) => void) {
  let live: LiveQuery | null = null
  return (m: ToWorker) => {
    if (m.type === 'init') live = createLiveQuery(m.input)
    else if (!live) return
    else if (m.type === 'apply') live.apply(m)
    else live.setQuery(m.input)
    post({ type: 'result', seq: m.seq, result: live!.result() })
  }
}
