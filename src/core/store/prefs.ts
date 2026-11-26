import { useSyncExternalStore } from 'react'

/** Per-device preferences in localStorage (spec/01 §6). Every access is wrapped in try/catch. */

export type Theme = 'system' | 'light' | 'dark'
const THEME_KEY = 'webnota:theme'
const themeListeners = new Set<() => void>()

export function getTheme(): Theme {
  try {
    return (localStorage.getItem(THEME_KEY) as Theme) || 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(t: Theme = getTheme()) {
  const root = document.documentElement
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1b1c1f' : '#ffffff')
}

export function setTheme(t: Theme) {
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    /* ignore */
  }
  applyTheme(t)
  themeListeners.forEach((l) => l())
}

export function useTheme(): Theme {
  return useSyncExternalStore((cb) => {
    themeListeners.add(cb)
    return () => themeListeners.delete(cb)
  }, getTheme)
}

/** Per-device set of expanded tree nodes. */
const EXP_KEY = 'webnota:expanded'
let expanded = new Set<string>(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(EXP_KEY) || '[]') as string[]
    } catch {
      return []
    }
  })(),
)
const expListeners = new Set<() => void>()
export function toggleExpanded(id: string, value?: boolean) {
  const next = new Set(expanded)
  const v = value ?? !next.has(id)
  if (v) next.add(id)
  else next.delete(id)
  expanded = next
  try {
    localStorage.setItem(EXP_KEY, JSON.stringify([...next]))
  } catch {
    /* ignore */
  }
  expListeners.forEach((l) => l())
}
export function useExpanded(): Set<string> {
  return useSyncExternalStore(
    (cb) => {
      expListeners.add(cb)
      return () => expListeners.delete(cb)
    },
    () => expanded,
  )
}
