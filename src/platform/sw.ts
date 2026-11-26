/**
 * Asks the service worker to fetch a new app version, then reloads. With
 * `registerType: 'autoUpdate'` a new worker activates by itself, so a reload is
 * enough to pick it up. Without a service worker (dev, unsupported) it just reloads.
 */
export async function updateApp(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    await reg?.update()
  } catch {
    /* offline or no service worker: the reload still retries */
  }
  location.reload()
}
