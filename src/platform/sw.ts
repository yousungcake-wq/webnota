/**
 * Service worker and app updates (MB-41, M7-10). A new version installs in the background
 * and waits (`registerType: 'prompt'`): the open app keeps running on its own files —
 * never reloaded under the user's hands — and `onUpdate` lets it say "update ready". The
 * new version starts with the next launch, or right away through `applyUpdate()`.
 */
let registration: ServiceWorkerRegistration | null = null
const CHECK_MS = 60 * 60 * 1000

export function registerServiceWorker(onUpdate: () => void) {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  const base = import.meta.env.BASE_URL
  const waitingUpdate = (w: ServiceWorker | null) => {
    // a waiting worker while another controls the page is an update (not the first install)
    if (w && navigator.serviceWorker.controller) onUpdate()
  }
  const start = async () => {
    try {
      const reg = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
      registration = reg
      waitingUpdate(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        w?.addEventListener('statechange', () => w.state === 'installed' && waitingUpdate(w))
      })
      // look for a new version now and then, and when the app comes back to the front
      setInterval(() => void reg.update().catch(() => {}), CHECK_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => {})
      })
    } catch {
      /* no service worker (private mode, unsupported): the app works online */
    }
  }
  if (document.readyState === 'complete') void start()
  else window.addEventListener('load', () => void start(), { once: true })
}

/** Switches to the waiting version and reloads; with none, checks for one, then reloads. */
export async function applyUpdate(): Promise<void> {
  const reg = registration ?? (await navigator.serviceWorker?.getRegistration().catch(() => undefined)) ?? null
  try {
    if (reg && !reg.waiting) await reg.update()
  } catch {
    /* offline: the reload still retries */
  }
  const waiting = reg?.waiting
  if (!waiting) return location.reload()
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
  waiting.postMessage({ type: 'SKIP_WAITING' })
}
