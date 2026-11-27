/// <reference lib="webworker" />
import { createWorkerHandler, type ToWorker } from './protocol'

// Query engine off the main thread for large databases (≥ WORKER_THRESHOLD rows, spec/05 §2).
const handle = createWorkerHandler((m) => (self as DedicatedWorkerGlobalScope).postMessage(m))
self.onmessage = (e: MessageEvent<ToWorker>) => handle(e.data)
