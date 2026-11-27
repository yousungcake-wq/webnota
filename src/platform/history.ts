/**
 * History entries for overlays (MB-14): opening a sheet/dialog pushes an entry so the
 * Android back button (and browser back) closes it instead of leaving the screen.
 *
 * Closing an overlay any other way (Esc, picking an item) pops its entry with
 * `history.back()`, which is asynchronous. Navigation must wait for that pop, or the
 * pop would undo the navigation — `whenHistoryIdle()` lets the router do so.
 */

interface Entry {
  id: number
  onPop: () => void
}

const stack: Entry[] = []
let nextId = 1
/** Programmatic `history.back()` calls whose popstate has not arrived yet. */
let ownPops = 0
let idle: Promise<void> = Promise.resolve()
let settle: (() => void) | null = null

const stateId = (): number => (history.state as { wnOverlay?: number } | null)?.wnOverlay ?? 0

window.addEventListener('popstate', () => {
  if (ownPops > 0) {
    ownPops -= 1
    if (ownPops === 0) {
      settle?.()
      settle = null
    }
    return
  }
  // User pressed back: close every overlay whose entry is now ahead of us.
  const current = stateId()
  while (stack.length && stack[stack.length - 1]!.id > current) stack.pop()!.onPop()
})

/**
 * Pushes an entry for an overlay. `onPop` runs if the user navigates back past it.
 * Returns `release`, to call when the overlay closes by other means.
 */
export function pushOverlayEntry(onPop: () => void): () => void {
  const entry: Entry = { id: nextId++, onPop }
  history.pushState({ ...(history.state as object | null), wnOverlay: entry.id }, '')
  stack.push(entry)
  return () => {
    const i = stack.indexOf(entry)
    if (i < 0) return // already popped by the back button
    const removed = stack.length - i
    stack.splice(i)
    // The app navigated while the overlay was open (a link in a sheet): its entry is behind
    // us now, and going back would undo that navigation (feedback 10). Leave it.
    if (stateId() < entry.id) return
    if (ownPops === 0) idle = new Promise((r) => (settle = r))
    ownPops += removed
    history.go(-removed)
  }
}

/** Resolves once pending overlay pops have been applied. */
export const whenHistoryIdle = (): Promise<void> => idle
export const historyBusy = (): boolean => ownPops > 0
