import type { ReactNode } from 'react'
import { Popover, Sheet } from './lazy'
import type { Placement } from './Popover'
import type { SheetSize } from './Sheet'

/** A popover on desktop and a bottom sheet on phones — the same content either way. */
export function Overlay({
  anchor,
  title,
  sheet,
  placement,
  sheetSize,
  onClose,
  children,
}: {
  anchor: HTMLElement | null
  title?: string
  sheet: boolean
  placement?: Placement
  /** Starting height of the phone sheet. */
  sheetSize?: SheetSize
  onClose: () => void
  children: ReactNode
}) {
  return sheet ? (
    <Sheet title={title} size={sheetSize} onClose={onClose}>
      {children}
    </Sheet>
  ) : (
    <Popover anchor={anchor} label={title} placement={placement} onClose={onClose}>
      {children}
    </Popover>
  )
}
