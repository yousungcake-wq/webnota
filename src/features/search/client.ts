import * as Y from 'yjs'
import { onAnyDocUpdate, openDoc, pageDocName, retainDoc } from '@/core/docs/registry'
import { currentWorkspaceId, idbName } from '@/core/docs/slots'
import { docPlainText } from '@/core/docs/text'
import { ws } from '@/core/docs/workspace'
import { isAlive, listViews } from '@/core/model/views'
import { createStore } from '@/core/store/createStore'
import type { SearchHit } from './engine'

/**
 * Main-thread side of full-text search (WS-07). Keeps the worker's index in step:
 * - at start, walks every live view in idle time, opening its doc only to compare the
 *   state vector with the indexed version (first run: indexes everything);
 * - edits to loaded docs and title changes re-index two seconds after the last change;
 * - deleted views are removed.
 */
let worker: Worker | null = null
let ready: Promise<Record<string, { title: string; version: string }>> | null = null
let reqId = 0
const pending = new Map<number, (hits: SearchHit[]) => void>()
/** Indexing progress for the UI: number of views still to check. */
export const indexingStore = createStore(0)

const version = (doc: Y.Doc) => {
  const sv = Y.encodeStateVector(doc)
  let s = ''
  for (const b of sv) s += String.fromCharCode(b)
  return btoa(s)
}
const idOf = (name: string) => (name.startsWith('doc/') ? name.slice(4) : null)
const idle = (cb: () => void) => (window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 50)))(cb)

function titles() {
  const views = listViews(ws())
  const byId = new Map(views.map((v) => [v.id, v]))
  return new Map(views.filter((v) => isAlive(byId, v.id)).map((v) => [v.id, v.title]))
}

export function startSearch() {
  if (ready) return ready
  worker = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data as { type: string; reqId?: number; hits?: SearchHit[]; meta?: Record<string, never> }
    if (m.type === 'results') {
      pending.get(m.reqId!)?.(m.hits!)
      pending.delete(m.reqId!)
    }
  }
  ready = new Promise((resolve) => {
    const onReady = (e: MessageEvent) => {
      if ((e.data as { type: string }).type !== 'ready') return
      worker!.removeEventListener('message', onReady)
      resolve((e.data as { meta: Record<string, { title: string; version: string }> }).meta)
    }
    worker!.addEventListener('message', onReady)
  })
  worker.postMessage({ type: 'init', db: idbName('search', currentWorkspaceId()) })
  void ready.then(reconcile)
  window.addEventListener('pagehide', () => worker?.postMessage({ type: 'flush' }))
  return ready
}

function upsert(id: string, title: string, doc: Y.Doc, meta: Record<string, { title: string; version: string }>) {
  const v = version(doc)
  meta[id] = { title, version: v }
  worker!.postMessage({ type: 'upsert', id, title, body: docPlainText(doc), version: v })
}

async function reconcile(meta: Record<string, { title: string; version: string }>) {
  const live = titles()
  for (const id of Object.keys(meta)) if (!live.has(id)) worker!.postMessage({ type: 'remove', id })
  const queue = [...live.keys()]
  indexingStore.set(queue.length)
  const next = () =>
    idle(async () => {
      const id = queue.shift()
      if (!id) return indexingStore.set(0)
      indexingStore.set(queue.length)
      const release = retainDoc(pageDocName(id))
      try {
        const doc = await openDoc(pageDocName(id))
        const title = titles().get(id)
        if (title !== undefined && (meta[id]?.version !== version(doc) || meta[id]?.title !== title))
          upsert(id, title, doc, meta)
      } finally {
        release()
      }
      next()
    })
  next()

  // Live: edited docs and renamed / deleted views, debounced.
  const dirty = new Map<string, Y.Doc>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    const now = titles()
    for (const [id, doc] of dirty) {
      const title = now.get(id)
      if (title !== undefined) upsert(id, title, doc, meta)
    }
    dirty.clear()
    for (const id of Object.keys(meta)) {
      if (!now.has(id)) {
        delete meta[id]
        worker!.postMessage({ type: 'remove', id })
      } else if (meta[id]!.title !== now.get(id)) {
        const title = now.get(id)!
        const release = retainDoc(pageDocName(id))
        void openDoc(pageDocName(id))
          .then((doc) => upsert(id, title, doc, meta))
          .finally(release)
      }
    }
  }
  onAnyDocUpdate((name, doc) => {
    const id = idOf(name)
    if (id) dirty.set(id, doc)
    else if (name !== 'workspace') return
    clearTimeout(timer)
    timer = setTimeout(flush, 2000)
  })
}

export async function search(q: string): Promise<SearchHit[]> {
  await startSearch()
  return new Promise((resolve) => {
    const id = ++reqId
    pending.set(id, resolve)
    worker!.postMessage({ type: 'query', q, reqId: id })
  })
}
