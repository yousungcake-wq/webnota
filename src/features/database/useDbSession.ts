import { useCallback, useSyncExternalStore } from 'react'
import { openDbSession, type DbSession, type DbState } from './session'

/**
 * Sessions shared by key and reference-counted by subscriptions: a view's database opens
 * when the first component subscribes and closes shortly after the last one leaves (the
 * delay survives StrictMode's unsubscribe/resubscribe and quick remounts).
 */
const sessions = new Map<string, { session: DbSession; refs: number; timer?: ReturnType<typeof setTimeout> }>()

function acquire(key: string, dbId: string, viewId: string) {
  let entry = sessions.get(key)
  if (!entry) {
    entry = { session: openDbSession(dbId, viewId), refs: 0 }
    sessions.set(key, entry)
  }
  clearTimeout(entry.timer)
  entry.refs++
  return entry.session
}

function release(key: string) {
  const entry = sessions.get(key)
  if (!entry || --entry.refs > 0) return
  entry.timer = setTimeout(() => {
    if (entry.refs > 0) return
    sessions.delete(key)
    entry.session.close()
  }, 1000)
}

/** The database session of a view while mounted (docs retained, query live). */
export function useDbSession(
  dbId: string | null,
  viewId: string,
): { session: DbSession | null; state: DbState | null } {
  const key = dbId ? `${dbId}/${viewId}` : ''
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!dbId) return () => {}
      const s = acquire(key, dbId, viewId)
      const off = s.store.subscribe(onChange)
      onChange()
      return () => {
        off()
        release(key)
      }
    },
    [key, dbId, viewId],
  )
  const getSnapshot = useCallback(() => sessions.get(key)?.session.store.get() ?? null, [key])
  const state = useSyncExternalStore(subscribe, getSnapshot)
  return { session: state ? (sessions.get(key)?.session ?? null) : null, state }
}
