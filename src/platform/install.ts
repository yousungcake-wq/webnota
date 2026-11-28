/**
 * App install (MB-40, M7-09), the part that must run at boot: Chrome's
 * `beforeinstallprompt` arrives early and is kept for an install button later; visits are
 * counted (once per tab session) so the install offer waits for a returning user.
 */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const VISITS_KEY = 'webnota:visits'
const INSTALLED_KEY = 'webnota:installed'
let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* private mode */
    }
  },
}

export function captureInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // our own button instead of the mini-infobar
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    store.set(INSTALLED_KEY, '1')
    notify()
  })
  try {
    if (!sessionStorage.getItem(VISITS_KEY)) {
      sessionStorage.setItem(VISITS_KEY, '1')
      store.set(VISITS_KEY, String(visits() + 1))
    }
  } catch {
    /* private mode: no counting */
  }
}

export const visits = () => Number(store.get(VISITS_KEY) ?? 0) || 0
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
export const isInstalled = () => isStandalone() || store.get(INSTALLED_KEY) === '1'
export const canPromptInstall = () => !!deferred
export const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function onInstallChange(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Shows the browser's install dialog; true when the user accepted. */
export async function promptInstall() {
  const e = deferred
  if (!e) return false
  deferred = null
  notify()
  await e.prompt()
  const { outcome } = await e.userChoice
  if (outcome === 'accepted') store.set(INSTALLED_KEY, '1')
  return outcome === 'accepted'
}

export const installStore = store
