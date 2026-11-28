import { t } from '@/core/i18n'
import { syncStore, syncNow } from '@/core/sync/controller'
import { haptic } from '@/platform/haptics'
import { toast } from '@/ui'
import './pullRefresh.css'

const TRIGGER = 64
const MAX = 96

/**
 * Pull to refresh (MB-15, M7-06): on the home and favorites screens of a phone, pulling down
 * from the top syncs right away. A bubble follows the finger, spins while syncing and shows
 * how it ended. Only when the list is scrolled to the very top; without GitHub it says how
 * to connect. Touch events, so normal scrolling stays native.
 */
export function attachPullRefresh(scroller: HTMLElement) {
  let start: { x: number; y: number } | null = null
  let pulling = false
  let dy = 0
  let bubble: HTMLElement | null = null
  let unsub: (() => void) | null = null
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  const show = () => {
    if (!bubble) {
      bubble = document.createElement('div')
      bubble.className = 'pull-refresh'
      bubble.setAttribute('role', 'status')
      document.body.append(bubble)
    }
    return bubble
  }
  const hide = () => {
    clearTimeout(hideTimer)
    unsub?.()
    unsub = null
    bubble?.remove()
    bubble = null
  }
  const place = (d: number) => {
    const b = show()
    const y = Math.min(d, MAX)
    b.style.transform = `translate(-50%, ${y - 40}px) rotate(${y * 3}deg)`
    b.classList.toggle('is-ready', d >= TRIGGER)
  }
  const run = () => {
    if (!syncStore.get().account) {
      hide()
      toast(t('sync.localOnlyHint'))
      return
    }
    const b = show()
    b.style.transform = `translate(-50%, ${TRIGGER - 40}px)`
    b.className = 'pull-refresh is-syncing'
    b.textContent = ''
    b.setAttribute('aria-label', t('sync.syncing'))
    haptic()
    syncNow()
    let seen = false
    const check = () => {
      const s = syncStore.get().status
      if (s === 'syncing' || s === 'pending') return void (seen = true)
      if (!seen && s !== 'offline' && s !== 'error') return
      unsub?.()
      unsub = null
      const ok = s === 'idle'
      if (bubble) {
        bubble.className = `pull-refresh is-done${ok ? '' : ' is-error'}`
        bubble.setAttribute('aria-label', ok ? t('sync.idle') : s === 'offline' ? t('sync.offline') : t('sync.error'))
      }
      hideTimer = setTimeout(hide, ok ? 600 : 1500)
    }
    unsub = syncStore.subscribe(check)
    check()
    // never spin forever (a sync waiting out a rate limit)
    hideTimer = setTimeout(hide, 15000)
  }

  const onStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    start = null
    if (e.touches.length !== 1 || !touch || scroller.scrollTop > 0 || unsub) return
    if ((e.target as Element).closest('input, textarea, .sheet')) return
    start = { x: touch.clientX, y: touch.clientY }
    pulling = false
    dy = 0
  }
  const onMove = (e: TouchEvent) => {
    const touch = e.touches[0]
    if (!start || !touch) return
    const d = touch.clientY - start.y
    if (!pulling) {
      if (d < 0 || Math.abs(touch.clientX - start.x) > Math.abs(d)) return void (start = null)
      if (d < 10 || scroller.scrollTop > 0) return
      pulling = true
      start.y = touch.clientY
    }
    if (e.cancelable) e.preventDefault()
    dy = Math.max(0, (touch.clientY - start.y) / 1.6) // resistance
    place(dy)
  }
  const onEnd = () => {
    if (!pulling) return
    const go = dy >= TRIGGER
    pulling = false
    start = null
    if (go) run()
    else hide()
  }
  scroller.addEventListener('touchstart', onStart, { passive: true })
  scroller.addEventListener('touchmove', onMove, { passive: false })
  scroller.addEventListener('touchend', onEnd)
  scroller.addEventListener('touchcancel', onEnd)
  return () => {
    scroller.removeEventListener('touchstart', onStart)
    scroller.removeEventListener('touchmove', onMove)
    scroller.removeEventListener('touchend', onEnd)
    scroller.removeEventListener('touchcancel', onEnd)
    hide()
  }
}
