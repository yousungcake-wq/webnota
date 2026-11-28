/** Progress of a long import / export (M8-08): `done` of `total` items; it can be stopped (M8-11). */
type Listener = (done: number, total: number) => void
let listener: Listener | null = null
let stop = false

/** Thrown at the next item after `cancel()`; what was done so far stays. */
export class Cancelled extends Error {
  constructor() {
    super('cancelled')
  }
}

export function onProgress(fn: Listener | null) {
  listener = fn
  stop = false
}

export function cancel() {
  stop = true
}

export function report(done: number, total: number) {
  if (stop) {
    stop = false
    throw new Cancelled()
  }
  listener?.(done, total)
}
