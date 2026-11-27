import { createLiveQuery, type QueryInput, type QueryResult, type RowSnapshot } from '@/core/model/database'
import type { FromWorker, ToWorker } from './protocol'

/** Databases with at least this many rows query in a worker (spec/05 §2). */
export const WORKER_THRESHOLD = 5000

/**
 * Runs a view's query incrementally, inline or in a worker. `onResult` gets every new
 * result; with a worker, results of superseded requests are dropped.
 */
export interface QueryRunner {
  apply(change: { upserts: RowSnapshot[]; deletes: string[] }): void
  setQuery(input: Omit<QueryInput, 'rows'>): void
  dispose(): void
}

export function createInlineRunner(input: QueryInput, onResult: (r: QueryResult) => void): QueryRunner {
  const live = createLiveQuery(input)
  onResult(live.result())
  return {
    apply(change) {
      live.apply(change)
      onResult(live.result())
    },
    setQuery(q) {
      live.setQuery(q)
      onResult(live.result())
    },
    dispose() {},
  }
}

export function createWorkerRunner(
  input: QueryInput,
  onResult: (r: QueryResult) => void,
  makeWorker = () => new Worker(new URL('./query.worker.ts', import.meta.url), { type: 'module' }),
): QueryRunner {
  const worker = makeWorker()
  let seq = 0
  const send = (m: ToWorker) => worker.postMessage(m)
  worker.onmessage = (e: MessageEvent<FromWorker>) => {
    if (e.data.seq === seq) onResult(e.data.result) // a newer request is on its way otherwise
  }
  send({ type: 'init', seq: ++seq, input })
  return {
    apply: (c) => send({ type: 'apply', seq: ++seq, upserts: c.upserts, deletes: c.deletes }),
    setQuery: (q) => send({ type: 'query', seq: ++seq, input: q }),
    dispose: () => worker.terminate(),
  }
}

export function createQueryRunner(input: QueryInput, onResult: (r: QueryResult) => void): QueryRunner {
  return input.rows.length >= WORKER_THRESHOLD && typeof Worker !== 'undefined'
    ? createWorkerRunner(input, onResult)
    : createInlineRunner(input, onResult)
}
