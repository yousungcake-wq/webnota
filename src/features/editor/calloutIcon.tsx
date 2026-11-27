import { lazy, Suspense } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { loadNamedIcon } from '@/features/emoji'
import { calloutIconFromValue } from './nodes/callout'

const NamedIcon = lazy(loadNamedIcon)
const roots = new WeakMap<HTMLElement, Root>()

/** Draws a callout's named icon (`icon:<name>[:<color>]`) into its icon button; null unmounts. */
export function renderCalloutIcon(el: HTMLElement, value: string | null) {
  let root = roots.get(el)
  const icon = value ? calloutIconFromValue(value) : null
  if (!icon || icon.type !== 'icon') {
    root?.unmount()
    roots.delete(el)
    return
  }
  if (!root) {
    root = createRoot(el)
    roots.set(el, root)
  }
  root.render(
    <Suspense fallback={null}>
      <NamedIcon name={icon.value} color={icon.color} size={20} />
    </Suspense>,
  )
}
