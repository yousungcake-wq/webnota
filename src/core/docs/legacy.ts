import { IndexeddbPersistence, storeState } from 'y-indexeddb'
import * as Y from 'yjs'
import { LEGACY_COPY_MARKER, legacyCopyDone, renameDirty } from './registry'
import { idbName } from './slots'

/**
 * One-time move of PoC-era IndexedDB databases into the workspace namespace:
 *   `webnota:workspace`            → `wn:<wsId>:workspace`        (M0-18)
 *   `webnota:doc/<id>`             → `wn:<wsId>:doc/<id>`         (M0-18)
 *   `webnota:page/<id>`            → `wn:<wsId>:doc/<id>`         (schema v2 rename, M0-16)
 * Every source of a target is merged into it (CRDT merge, idempotent), force-written,
 * then the sources are deleted. A failure keeps the sources and leaves the marker unset,
 * so the next boot retries.
 */

const LEGACY = /^webnota:(workspace|doc\/[A-Za-z0-9_-]+|page\/[A-Za-z0-9_-]+)$/

export interface LegacyCopyEnv {
  /** All IndexedDB database names; absent where `indexedDB.databases()` is unsupported. */
  listDatabases?: () => Promise<string[]>
  isDone(): boolean
  markDone(): void
  renameDirty(from: string, to: string): void
}

const targetOf = (legacyDocName: string) => legacyDocName.replace(/^page\//, 'doc/')

async function open(name: string) {
  const doc = new Y.Doc()
  const p = new IndexeddbPersistence(name, doc)
  await p.whenSynced
  return { doc, p }
}

/** Without `indexedDB.databases()`: probe the old workspace's view/page ids. */
async function probeNames(): Promise<string[]> {
  const { doc, p } = await open('webnota:workspace')
  const ids = new Set([...doc.getMap('views').keys(), ...doc.getMap('pages').keys()])
  await p.destroy()
  doc.destroy()
  return ['webnota:workspace', ...[...ids].flatMap((id) => [`webnota:page/${id}`, `webnota:doc/${id}`])]
}

/** Copies into `wsId`'s namespace. Returns the target doc names that received data. */
export async function copyLegacyDocs(wsId: string, env: LegacyCopyEnv): Promise<string[]> {
  if (env.isDone()) return []
  const names = env.listDatabases ? (await env.listDatabases()).filter((n) => LEGACY.test(n)) : await probeNames()
  const groups = new Map<string, string[]>()
  for (const n of names) {
    const docName = LEGACY.exec(n)![1]!
    const target = targetOf(docName)
    groups.set(target, [...(groups.get(target) ?? []), docName])
  }

  const copied: string[] = []
  let failed = false
  for (const [target, sources] of groups) {
    try {
      const opened = await Promise.all(sources.map((s) => open(`webnota:${s}`)))
      const withData = opened.filter(({ doc }) => Y.encodeStateVector(doc).length > 1)
      if (withData.length) {
        const dest = await open(idbName(target, wsId))
        for (const { doc } of withData) Y.applyUpdate(dest.doc, Y.encodeStateAsUpdate(doc))
        await storeState(dest.p, true)
        await dest.p.destroy()
        dest.doc.destroy()
        copied.push(target)
      }
      for (const { doc, p } of opened) {
        await p.clearData() // deletes the old database
        doc.destroy()
      }
      for (const s of sources) if (s !== target) env.renameDirty(s, target)
    } catch (e) {
      failed = true
      console.error('[webnota] moving legacy IndexedDB data failed', target, e)
    }
  }
  if (!failed) env.markDone()
  return copied
}

/** Boot-time move with the real environment. Must run before any doc is opened. */
export function runLegacyDocCopy(wsId: string): Promise<string[]> {
  const list = typeof indexedDB.databases === 'function' ? indexedDB.databases.bind(indexedDB) : null
  return copyLegacyDocs(wsId, {
    listDatabases: list ? async () => (await list()).map((d) => d.name ?? '') : undefined,
    isDone: legacyCopyDone,
    markDone: () => {
      try {
        localStorage.setItem(LEGACY_COPY_MARKER, '1')
      } catch {
        /* retried next boot; copying again is a no-op */
      }
    },
    renameDirty,
  })
}
