import { lazy, Suspense } from 'react'
import { createStore } from '@/core/store/createStore'
import { useStore } from '@/core/store/useStore'
import { afterMenuClosed } from './rename'
import type { Open as OpenOverlay } from './overlayViews'

const OverlayViews = lazy(() => import('./overlayViews'))

/**
 * Page overlays opened from menus that close themselves first (icon picker, info).
 * `<PageOverlays />` is mounted once by the app shell.
 */
const store = createStore<OpenOverlay | null>(null)

export const openIconPicker = (viewId: string, anchor: HTMLElement | null) =>
  void afterMenuClosed().then(() => store.set({ kind: 'icon', viewId, anchor }))
export const openViewInfo = (viewId: string) => void afterMenuClosed().then(() => store.set({ kind: 'info', viewId }))

export function PageOverlays() {
  const open = useStore(store)
  if (!open) return null
  return (
    <Suspense fallback={null}>
      <OverlayViews open={open} close={() => store.set(null)} />
    </Suspense>
  )
}
