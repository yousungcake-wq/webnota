import { pushOverlayEntry } from '@/platform/history'

/**
 * The one registry of open overlays (spec/12 §2 OverlayHost): stacking order, Esc
 * closes only the top layer, body scroll lock while a modal layer is open, and
 * optional history entries so the back button closes the layer (MB-14).
 */
interface Layer {
  close: () => void
  modal: boolean
}

const layers: Layer[] = []

function syncScrollLock() {
  document.documentElement.classList.toggle(
    'overlay-open',
    layers.some((l) => l.modal),
  )
}

window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return
  const top = layers[layers.length - 1]
  if (!top) return
  e.preventDefault()
  e.stopPropagation()
  top.close()
})

export interface LayerOptions {
  /** Blocks the page (scroll lock). Default true. */
  modal?: boolean
  /** Push a history entry so back closes the layer. Default false. */
  history?: boolean
}

export interface LayerHandle {
  isTop: () => boolean
  /** Unregisters; also pops the history entry if the layer had one and it is still there. */
  release: () => void
}

export function registerLayer(close: () => void, { modal = true, history = false }: LayerOptions = {}): LayerHandle {
  const layer: Layer = { close, modal }
  layers.push(layer)
  syncScrollLock()
  let releaseEntry: (() => void) | null = history ? pushOverlayEntry(() => close()) : null
  return {
    isTop: () => layers[layers.length - 1] === layer,
    release() {
      const i = layers.indexOf(layer)
      if (i >= 0) layers.splice(i, 1)
      syncScrollLock()
      releaseEntry?.()
      releaseEntry = null
    },
  }
}

export const openLayerCount = () => layers.length
