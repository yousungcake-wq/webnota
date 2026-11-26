import { createStore } from '../store/createStore'

/**
 * Sync log (SY-02d): the last 50 runs with time, result, file counts and error, shown in
 * Settings (ST-04). Kept in localStorage so every tab shows the leader's runs. Runs that
 * changed nothing (the minute pull) and repeated identical errors fold into one entry.
 */
export interface SyncLogEntry {
  at: number
  ok: boolean
  pulled: number
  pushed: number
  deleted: number
  ms: number
  error?: string
  /** Folded runs: how many, and when the first of them happened. */
  repeat?: number
  firstAt?: number
}

const KEY = 'webnota:sync-log'
const MAX = 50

const isNoop = (e: SyncLogEntry) => e.ok && e.pulled + e.pushed + e.deleted === 0
const sameKind = (a: SyncLogEntry, b: SyncLogEntry) =>
  (isNoop(a) && isNoop(b)) || (!a.ok && !b.ok && a.error === b.error)

export function appendLog(log: SyncLogEntry[], entry: SyncLogEntry): SyncLogEntry[] {
  const last = log[0]
  if (last && sameKind(last, entry)) {
    const folded = { ...entry, repeat: (last.repeat ?? 1) + 1, firstAt: last.firstAt ?? last.at }
    return [folded, ...log.slice(1)]
  }
  return [entry, ...log].slice(0, MAX)
}

function load(): SyncLogEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]') as unknown
    return Array.isArray(v) ? (v as SyncLogEntry[]) : []
  } catch {
    return []
  }
}

/** Read in React with `useStore(syncLogStore)`. */
export const syncLogStore = createStore<SyncLogEntry[]>(load())

export function recordSync(entry: SyncLogEntry) {
  syncLogStore.set((log) => appendLog(log, entry))
  try {
    localStorage.setItem(KEY, JSON.stringify(syncLogStore.get()))
  } catch {
    /* storage full or unavailable: the log stays in memory */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) syncLogStore.set(load())
  })
}
