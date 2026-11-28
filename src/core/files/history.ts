import { getToken } from '../auth/auth'
import { syncStore } from '../sync/controller'
import { CleanupError } from './cleanup'

/**
 * Repository size and history cleanup for settings (SY-03, M6-09), loaded when shown.
 * GitHub recommends staying under ~1GB; WebNota suggests a cleanup from 500MB.
 */
export const SIZE_WARN_BYTES = 500 * 1024 * 1024

function connection() {
  const account = syncStore.get().account
  const token = getToken()
  if (!account || !token) throw new CleanupError('not-connected')
  return { account, token }
}

export async function repositorySize(): Promise<number | null> {
  const { account, token } = connection()
  return (await import('../sync/remote')).repoSize(account, token)
}

/** Syncs first (so this device's changes are in), then squashes the history. */
export async function cleanHistory(): Promise<'done' | 'moved' | 'empty'> {
  const { account, token } = connection()
  if (globalThis.navigator?.onLine === false) throw new CleanupError('offline')
  const net = await import('../sync/remote')
  if (!(await net.runSession(account, token)).ok) throw new CleanupError('sync-failed')
  return net.squashHistory(account, token)
}
