import type { ReactNode } from 'react'
import { Popover, type Placement } from './Popover'
import { Sheet } from './Sheet'

/** A popover on desktop and a bottom sheet on phones — the same content either way. */
export function Overlay({
  anchor,
  title,
  sheet,
  placement,
  onClose,
  children,
}: {
  anchor: HTMLElement | null
  title?: string
  sheet: boolean
  placement?: Placement
  onClose: () => void
  children: ReactNode
}) {
  return sheet ? (
    <Sheet title={title} onClose={onClose}>
      {children}
    </Sheet>
  ) : (
    <Popover anchor={anchor} label={title} placement={placement} onClose={onClose}>
      {children}
    </Popover>
  )
}
