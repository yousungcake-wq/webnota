import { describe, expect, it } from 'vitest'
import { runQuery, type FieldMeta, type QueryResult, type RowSnapshot } from '@/core/model/database'
import { createWorkerHandler, type FromWorker, type ToWorker } from './protocol'
import { createInlineRunner, createWorkerRunner } from './runner'

const fields: FieldMeta[] = [{ id: 'n', name: 'n', type: 'number', options: {}, createdAt: 0 }]
const row = (id: string, n: number): RowSnapshot => ({
  id,
  order: id,
  cells: { n },
  icon: null,
  cover: null,
  hasDoc: false,
  createdAt: 0,
  createdBy: '',
  updatedAt: 0,
  updatedBy: '',
})
const view = {
  filter: { op: 'and' as const, items: [{ id: 'f', fieldId: 'n', cond: 'gt' as const, value: 1 }] },
  sorts: [{ id: 's', fieldId: 'n', dir: 'desc' as const }],
  calcs: { n: 'sum' as const },
}

/** A fake Worker running the real handler asynchronously, like postMessage does. */
function fakeWorker() {
  const w = {
    onmessage: null as ((e: MessageEvent<FromWorker>) => void) | null,
    postMessage(m: ToWorker) {
      queueMicrotask(() => handle(structuredClone(m)))
    },
    terminate() {},
  }
  const handle = createWorkerHandler((m) =>
    queueMicrotask(() => w.onmessage?.({ data: m } as MessageEvent<FromWorker>)),
  )
  return w as unknown as Worker
}

describe('query runners (M4-04)', () => {
  it('inline and worker runners give the same results as runQuery', async () => {
    const rows = [row('a', 1), row('b', 5), row('c', 3)]
    const inline: QueryResult[] = []
    const viaWorker: QueryResult[] = []
    const r1 = createInlineRunner({ fields, rows, view, now: 0 }, (r) => inline.push(r))
    const r2 = createWorkerRunner({ fields, rows, view, now: 0 }, (r) => viaWorker.push(r), fakeWorker)
    await new Promise((r) => setTimeout(r))
    for (const r of [r1, r2]) r.apply({ upserts: [row('a', 9)], deletes: ['c'] })
    await new Promise((r) => setTimeout(r))
    const expected = runQuery({ fields, rows: [row('a', 9), row('b', 5)], view, now: 0 })
    expect(inline.at(-1)).toEqual(expected)
    expect(viaWorker.at(-1)).toEqual(expected)
    expect(expected.rowIds).toEqual(['a', 'b'])
  })

  it('the worker runner drops results of superseded requests', async () => {
    const got: QueryResult[] = []
    const r = createWorkerRunner({ fields, rows: [row('a', 2)], view, now: 0 }, (x) => got.push(x), fakeWorker)
    r.setQuery({ fields, view: { ...view, filter: null }, now: 0 })
    r.apply({ upserts: [row('b', 0)], deletes: [] })
    await new Promise((res) => setTimeout(res))
    expect(got).toHaveLength(1)
    expect(got[0]!.rowIds).toEqual(['a', 'b'])
  })
})
