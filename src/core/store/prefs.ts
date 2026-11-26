import { createStore } from './createStore'
import { useStore } from './useStore'

/** Per-device preferences in localStorage (spec/01 §6). Every access is wrapped in try/catch. */

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage full or blocked: keep the in-memory value */
  }
}

export type Theme = 'system' | 'light' | 'dark'
const THEME_KEY = 'webnota:theme'
const themeStore = createStore<Theme>((read(THEME_KEY) as Theme | null) || 'system')

export const getTheme = (): Theme => themeStore.get()

export function applyTheme(t: Theme = getTheme()) {
  const root = document.documentElement
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1b1c1f' : '#ffffff')
}

export function setTheme(t: Theme) {
  write(THEME_KEY, t)
  applyTheme(t)
  themeStore.set(t)
}

export const useTheme = (): Theme => useStore(themeStore)

/** Per-device set of expanded tree nodes. */
const EXP_KEY = 'webnota:expanded'
const expandedStore = createStore(
  new Set<string>(
    (() => {
      try {
        return JSON.parse(read(EXP_KEY) || '[]') as string[]
      } catch {
        return []
      }
    })(),
  ),
)

export function toggleExpanded(id: string, value?: boolean) {
  const next = new Set(expandedStore.get())
  if (value ?? !next.has(id)) next.add(id)
  else next.delete(id)
  write(EXP_KEY, JSON.stringify([...next]))
  expandedStore.set(next)
}

export const useExpanded = (): Set<string> => useStore(expandedStore)
