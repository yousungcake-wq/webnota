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
  // Browser chrome follows the page background token (styles/tokens.css).
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
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

/** Space shown in the sidebar, per device (WS-02). Validated against the workspace by `useCurrentSpace`. */
const SPACE_KEY = 'webnota:space'
export const spacePrefStore = createStore<string | null>(read(SPACE_KEY))
export function setCurrentSpace(id: string) {
  write(SPACE_KEY, id)
  spacePrefStore.set(id)
}

/** Empty trash items older than 30 days on startup (WS-06), per device. Off by default. */
const TRASH_AUTO_KEY = 'webnota:trash-auto-empty'
export const trashAutoEmptyStore = createStore<boolean>(read(TRASH_AUTO_KEY) === '1')
export function setTrashAutoEmpty(on: boolean) {
  write(TRASH_AUTO_KEY, on ? '1' : '0')
  trashAutoEmptyStore.set(on)
}

/** Recently opened views, newest first, per device (WS-05). */
const RECENT_KEY = 'webnota:recent'
const RECENT_MAX = 30
export const recentStore = createStore<string[]>(
  (() => {
    try {
      const v = JSON.parse(read(RECENT_KEY) || '[]') as unknown
      return Array.isArray(v) ? (v as string[]).slice(0, RECENT_MAX) : []
    } catch {
      return []
    }
  })(),
)
export function pushRecent(id: string) {
  const prev = recentStore.get()
  if (prev[0] === id) return
  const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_MAX)
  write(RECENT_KEY, JSON.stringify(next))
  recentStore.set(next)
}
export const useRecent = (): string[] => useStore(recentStore)
