import { t } from '@/core/i18n'
import { ReadOnlyError } from '@/core/model/pages'
import { toast } from '@/ui'

/** Benign browser noise that should never reach the user. */
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/]
const DEDUPE_MS = 5000

/**
 * Errors outside React rendering (event handlers, timers, promises) become an error
 * toast (spec/01 §7), at most once per message every few seconds. Rendering errors
 * are handled by the screen ErrorBoundaries instead.
 */
export function installGlobalErrorToasts() {
  const lastShown = new Map<string, number>()
  const report = (reason: unknown) => {
    if (reason instanceof ReadOnlyError) {
      toast(t('schema.readOnlyToast'), { tone: 'error' })
      return
    }
    const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : String(reason)
    if (!message || IGNORED.some((re) => re.test(message))) return
    const now = Date.now()
    if (now - (lastShown.get(message) ?? 0) < DEDUPE_MS) return
    lastShown.set(message, now)
    toast(t('error.unexpected', { message }), { tone: 'error', duration: 8000 })
  }
  window.addEventListener('error', (e) => report(e.error ?? e.message))
  window.addEventListener('unhandledrejection', (e) => report(e.reason))
}
