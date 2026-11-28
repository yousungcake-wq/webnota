/** Progress of a long import / export (M8-08): `done` of `total` items. */
type Listener = (done: number, total: number) => void
let listener: Listener | null = null

export function onProgress(fn: Listener | null) {
  listener = fn
}

export function report(done: number, total: number) {
  listener?.(done, total)
}
