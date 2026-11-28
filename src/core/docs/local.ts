import { allFiles } from '../files/db'
import { getDirty } from './registry'

/**
 * This device's copy of the data (ST-08, M8-10): what is not synced yet, and removing
 * everything WebNota keeps here (every workspace's databases, settings, caches, the
 * service worker). The GitHub repositories are not touched.
 */
export async function unsyncedCounts(): Promise<{ docs: number; files: number }> {
  return { docs: Object.keys(getDirty()).length, files: (await allFiles('pending')).length }
}

export async function deleteLocalData(): Promise<void> {
  const dbs = (await indexedDB.databases?.()) ?? []
  await Promise.all(
    dbs
      .map((d) => d.name ?? '')
      .filter((n) => n.startsWith('wn:') || n.startsWith('webnota') || n.startsWith('$'))
      .map(
        (name) =>
          new Promise((r) => {
            const req = indexedDB.deleteDatabase(name)
            req.onsuccess = req.onerror = req.onblocked = () => r(null)
          }),
      ),
  )
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)
    if (k?.startsWith('webnota')) localStorage.removeItem(k)
  }
  try {
    sessionStorage.clear()
  } catch {
    /* private mode */
  }
  if (typeof caches !== 'undefined') for (const name of await caches.keys()) await caches.delete(name)
  for (const reg of (await navigator.serviceWorker?.getRegistrations?.()) ?? []) await reg.unregister()
}
