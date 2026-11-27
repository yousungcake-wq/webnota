/**
 * When to sync (SY-02b,c). Pure timing logic — the controller supplies `sync`.
 *
 * - Edits: push 4 s after the last edit, but at most 60 s after the first unsynced one
 *   (continuous typing still gets pushed). Automatic syncs stay at least 8 s apart
 *   (GitHub's limit on content-creating requests, ~80/min); the button is never held back.
 * - Pulls: every 20 s while the page is visible (an unchanged check is a 304, which does
 *   not count against the rate limit).
 * - Failures: exponential backoff 10 s → 5 min. Periodic pulls wait for it; going
 *   online, hiding/showing the page and the manual button bypass it.
 * - Rate limit (403/429 with reset/retry-after): nothing runs before the reset time.
 * - Final errors (expired login): no automatic retry.
 * - One sync at a time; requests during a sync run once afterwards.
 */

export const PUSH_DEBOUNCE_MS = 4_000
export const PUSH_MAX_WAIT_MS = 60_000
export const MIN_PUSH_GAP_MS = 8_000
export const PULL_INTERVAL_MS = 20_000
const BACKOFF_BASE_MS = 10_000
const BACKOFF_MAX_MS = 5 * 60_000

export type SyncOutcome =
  | { ok: true }
  | { ok: false; error: unknown; /** rate limited: wait this long */ retryAfterMs?: number | null; final?: boolean }

export type SyncReason = 'manual' | 'interval' | 'hidden' | 'visible' | 'online' | 'start'

export function pushDelay(now: number, firstDirtyAt: number): number {
  return Math.max(0, Math.min(PUSH_DEBOUNCE_MS, firstDirtyAt + PUSH_MAX_WAIT_MS - now))
}

export function backoffDelay(failures: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, failures - 1), BACKOFF_MAX_MS)
}

/** Wait (ms) demanded by a GitHub rate-limit response, or null if it is not one. */
export function retryAfter(status: number, headers: Headers, now: number): number | null {
  if (status !== 403 && status !== 429) return null
  const after = headers.get('retry-after')
  if (after && Number.isFinite(Number(after))) return Number(after) * 1000
  if (headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(headers.get('x-ratelimit-reset'))
    if (Number.isFinite(reset)) return Math.max(0, reset * 1000 - now)
  }
  return status === 429 ? BACKOFF_BASE_MS : null
}

export interface SchedulerState {
  failures: number
  /** No automatic sync before this time (backoff or rate limit). */
  blockedUntil: number
  rateLimited: boolean
}

export function createScheduler(deps: {
  sync: () => Promise<SyncOutcome>
  hasDirty: () => boolean
  now?: () => number
}) {
  const now = deps.now ?? Date.now
  let failures = 0
  let blockedUntil = 0
  let rateLimited = false
  let final = false
  let firstDirtyAt: number | null = null
  let pushAt: number | null = null
  /** When the last sync finished: automatic pushes wait MIN_PUSH_GAP_MS after it. */
  let lastSyncAt = -Infinity
  const nextPush = (t: number, first: number) => Math.max(t + pushDelay(t, first), lastSyncAt + MIN_PUSH_GAP_MS)
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let pending = false
  let disposed = false

  const plan = () => {
    clearTimeout(timer)
    timer = undefined
    if (disposed) return
    const candidates: number[] = []
    if (pushAt !== null) candidates.push(pushAt)
    if (failures > 0 && !final) candidates.push(blockedUntil)
    if (!candidates.length) return
    const at = Math.max(Math.min(...candidates), blockedUntil)
    timer = setTimeout(() => void fire(), Math.max(0, at - now()))
  }

  const fire = async () => {
    if (running) {
      pending = true
      return
    }
    clearTimeout(timer)
    timer = undefined
    pushAt = null
    running = true
    let outcome: SyncOutcome
    try {
      outcome = await deps.sync()
    } catch (error) {
      outcome = { ok: false, error }
    }
    running = false
    const t = now()
    lastSyncAt = t
    if (outcome.ok) {
      failures = 0
      blockedUntil = 0
      rateLimited = false
      final = false
      firstDirtyAt = deps.hasDirty() ? t : null
      if (firstDirtyAt !== null) pushAt = nextPush(t, firstDirtyAt)
    } else {
      failures++
      final = outcome.final ?? false
      rateLimited = outcome.retryAfterMs != null
      blockedUntil = final ? 0 : t + (outcome.retryAfterMs ?? backoffDelay(failures))
    }
    if (pending) {
      pending = false
      request('interval')
    }
    plan()
  }

  function request(reason: SyncReason) {
    if (disposed) return
    if (running) {
      pending = true
      return
    }
    const blocked = now() < blockedUntil
    if (blocked && (rateLimited || reason === 'interval')) return
    void fire()
  }

  return {
    request,
    /** Local changes were made. */
    edited() {
      const t = now()
      if (firstDirtyAt === null) firstDirtyAt = t
      pushAt = nextPush(t, firstDirtyAt)
      plan()
    },
    state: (): SchedulerState => ({ failures, blockedUntil, rateLimited }),
    dispose() {
      disposed = true
      clearTimeout(timer)
    },
  }
}
