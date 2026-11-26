import * as Y from 'yjs'

/**
 * Keeps tabs of the same browser in step (SY-02e). Each tab has its own Y.Docs; y-indexeddb
 * shares storage but does not push changes between live tabs. The relay broadcasts every
 * update of an open doc (local edits and GitHub merges alike) so the sync leader tab
 * always pushes the latest content. Updates received from another tab use `TAB_ORIGIN`:
 * they are not marked dirty again (the tab that made them did) and not re-broadcast.
 * Other message types carry sync requests and status between leader and followers.
 */
export const TAB_ORIGIN = 'webnota-tab'

export interface TabMessage {
  type: string
  [key: string]: unknown
}

export interface TabRelay {
  attach(docName: string, doc: Y.Doc, skipOrigins?: unknown[]): void
  post(message: TabMessage): void
  on(type: string, cb: (message: TabMessage) => void): () => void
  close(): void
}

export function createTabRelay(channelName: string, lookup: (docName: string) => Y.Doc | undefined): TabRelay {
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(channelName) : null
  ;(channel as unknown as { unref?: () => void } | null)?.unref?.() // Node (tests): don't keep the process alive
  const listeners = new Map<string, Set<(m: TabMessage) => void>>()
  if (channel) {
    channel.onmessage = (e: MessageEvent<TabMessage>) => {
      const m = e.data
      if (m.type === 'update') {
        const doc = lookup(m.doc as string)
        if (doc) Y.applyUpdate(doc, m.update as Uint8Array, TAB_ORIGIN)
        return
      }
      listeners.get(m.type)?.forEach((cb) => cb(m))
    }
  }
  return {
    attach(docName, doc, skipOrigins = []) {
      if (!channel) return
      doc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin === TAB_ORIGIN || skipOrigins.includes(origin)) return
        channel.postMessage({ type: 'update', doc: docName, update })
      })
    },
    post(message) {
      channel?.postMessage(message)
    },
    on(type, cb) {
      const set = listeners.get(type) ?? new Set()
      set.add(cb)
      listeners.set(type, set)
      return () => set.delete(cb)
    },
    close() {
      channel?.close()
    },
  }
}
