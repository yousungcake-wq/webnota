/**
 * Haptics (MB-16, M7-07): a short vibration on drag start, long press and checkbox toggles.
 * Android only in practice (`navigator.vibrate`; iOS Safari has none); off in settings.
 */
const KEY = 'webnota:haptics'

export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator

export function hapticsOn() {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export function setHapticsOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* a per-device convenience */
  }
}

export function haptic(ms = 10) {
  if (canVibrate() && hapticsOn()) navigator.vibrate(ms)
}
