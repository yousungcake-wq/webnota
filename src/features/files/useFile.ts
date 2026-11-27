import { useEffect, useState } from 'react'
import type { FileStatus, FileView } from '@/core/files/cache'
import { syncStore } from '@/core/sync/controller'
import { useStore } from '@/core/store/useStore'

export type FileState = { status: FileStatus | 'loading'; url: string | null }

const LOADING: FileState = { status: 'loading', url: null }
const loadCache = () => import('@/core/files/cache')

/** Selector: anything that can make an unavailable file available (connect, a finished sync). */
const syncKey = (s: ReturnType<typeof syncStore.get>) => `${s.account?.repo ?? ''}|${s.lastSyncedAt ?? 0}`

/**
 * Object URL of a workspace file (SY-04, M3-02). The cache code loads on first use; a
 * file that is not available yet is retried after connecting, after each sync and when
 * the device comes back online.
 */
export function useFile(id: string | null): FileState & { retry: () => void } {
  const [state, setState] = useState<{ id: string | null; view: FileState }>({ id: null, view: LOADING })
  const [tick, setTick] = useState(0)
  const sync = useStore(syncStore, syncKey)
  const view = state.id === id ? state.view : LOADING
  const waiting = view.status !== 'ready' && view.status !== 'loading'

  useEffect(() => {
    if (!id) return
    let alive = true
    void loadCache()
      .then((m) => m.loadFile(id))
      .then(
        (v: FileView) => alive && setState({ id, view: v }),
        () => alive && setState({ id, view: { status: 'error', url: null } }),
      )
    return () => {
      alive = false
    }
    // `sync` and `tick` re-run the load (retry); a ready file resolves from memory at once
  }, [id, sync, tick])

  useEffect(() => {
    if (!waiting) return
    const online = () => setTick((n) => n + 1)
    window.addEventListener('online', online)
    return () => window.removeEventListener('online', online)
  }, [waiting])

  return { ...view, retry: () => setTick((n) => n + 1) }
}

/** i18n key of the note shown instead of an unavailable file. */
export function fileStatusKey(status: FileState['status']) {
  switch (status) {
    case 'loading':
    case 'ready':
      return 'files.loading'
    case 'not-connected':
      return 'files.notConnected'
    case 'offline':
      return 'files.offline'
    case 'missing':
      return 'files.missing'
    default:
      return 'files.error'
  }
}

/**
 * `src` for an image stored as a workspace file id or (older data) a URL — page icons
 * and covers (ED-F11, ED-F12). Null until the file is available.
 */
export function useImageSrc(value: string | null): string | null {
  const isUrl = !!value && /^(https?:|data:|blob:)/i.test(value)
  const file = useFile(value && !isUrl ? value : null)
  return isUrl ? value : file.url
}
