import { lazy, Suspense, type ComponentProps } from 'react'
import type * as PopoverNs from './Popover'
import type * as SheetNs from './Sheet'

/**
 * The sheet and the popover are their own chunk (start bundle budget, spec/10), fetched
 * when the app is idle (`preloadOverlays`) — the first menu then opens without a wait.
 */
const loadPopover = () => import('./Popover')
const loadSheet = () => import('./Sheet')
const PopoverImpl = lazy(() => loadPopover().then((m) => ({ default: m.Popover })))
const SheetImpl = lazy(() => loadSheet().then((m) => ({ default: m.Sheet })))

export function preloadOverlays() {
  void loadPopover()
  void loadSheet()
}

export function Popover(props: ComponentProps<typeof PopoverNs.Popover>) {
  return (
    <Suspense fallback={null}>
      <PopoverImpl {...props} />
    </Suspense>
  )
}

export function Sheet(props: ComponentProps<typeof SheetNs.Sheet>) {
  return (
    <Suspense fallback={null}>
      <SheetImpl {...props} />
    </Suspense>
  )
}
