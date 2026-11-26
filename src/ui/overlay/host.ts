import type { ReactNode } from 'react'

/** Imperative overlays (confirm dialogs, toasts) rendered by <OverlayHost>. */
export interface ConfirmRequest {
  id: number
  title?: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

export interface ToastItem {
  id: number
  message: string
  action?: { label: string; onClick: () => void }
  tone?: 'default' | 'error'
  duration: number
}

interface HostState {
  confirms: ConfirmRequest[]
  toasts: ToastItem[]
}

let state: HostState = { confirms: [], toasts: [] }
let nextId = 1
const listeners = new Set<() => void>()
const set = (s: HostState) => {
  state = s
  listeners.forEach((l) => l())
}

export const hostStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
}

/** Asks for confirmation in an in-app dialog (replaces window.confirm). */
export function confirmDialog(opts: Omit<ConfirmRequest, 'id' | 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    const id = nextId++
    set({
      ...state,
      confirms: [
        ...state.confirms,
        {
          ...opts,
          id,
          resolve: (ok) => {
            set({ ...state, confirms: state.confirms.filter((c) => c.id !== id) })
            resolve(ok)
          },
        },
      ],
    })
  })
}

/** Shows a toast; returns a function that dismisses it early. Max 3 visible. */
export function toast(
  message: string,
  opts: { action?: ToastItem['action']; tone?: ToastItem['tone']; duration?: number } = {},
): () => void {
  const id = nextId++
  const item: ToastItem = { id, message, duration: opts.duration ?? (opts.action ? 6000 : 4000), ...opts }
  set({ ...state, toasts: [...state.toasts, item].slice(-3) })
  return () => dismissToast(id)
}

export function dismissToast(id: number) {
  if (state.toasts.some((t) => t.id === id)) set({ ...state, toasts: state.toasts.filter((t) => t.id !== id) })
}
