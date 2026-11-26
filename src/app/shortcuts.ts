import { useEffect } from 'react'
import { getTheme, setTheme } from '@/core/store/prefs'
import { useCurrentSpace } from '@/core/store/views'
import { addPage } from '@/features/page'

export const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
export const mod = (e: KeyboardEvent) => (isMac ? e.metaKey : e.ctrlKey)

/**
 * App-wide shortcuts (WS-14). ⌘K (palette) and ⌘\ (sidebar) live with their features.
 * ⌘N is often taken by the browser (new window), so ⌘⌥N works too.
 */
export function useGlobalShortcuts(openHelp: () => void) {
  const spaceId = useCurrentSpace()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!mod(e)) return
      const key = e.key.toLowerCase()
      let handled = true
      if (key === 'n' || (e.altKey && e.code === 'KeyN')) {
        addPage(null, spaceId)
      } else if (e.shiftKey && key === 'l') {
        const dark =
          getTheme() === 'dark' || (getTheme() === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
        setTheme(dark ? 'light' : 'dark')
      } else if (key === '[' && !e.shiftKey) history.back()
      else if (key === ']' && !e.shiftKey) history.forward()
      else if (key === '/' || e.code === 'Slash') openHelp()
      else handled = false
      if (handled) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [spaceId, openHelp])
}
