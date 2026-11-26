import { lazy, Suspense, useEffect } from 'react'
import { createStore } from '@/core/store/createStore'
import { useStore } from '@/core/store/useStore'

const Palette = lazy(() => import('./Palette'))

/** Command palette open state (WS-07). */
export const paletteStore = createStore(false)
export const openPalette = () => paletteStore.set(true)

/** Mount once: ⌘K / Ctrl+K toggles the palette; renders it (lazy) while open. */
export function PaletteHost() {
  const open = useStore(paletteStore)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        paletteStore.set(!paletteStore.get())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!open) return null
  return (
    <Suspense fallback={null}>
      <Palette onClose={() => paletteStore.set(false)} />
    </Suspense>
  )
}
