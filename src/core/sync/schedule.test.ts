import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backoffDelay, createScheduler, pushDelay, retryAfter, type SyncOutcome } from './schedule'

const S = 1000

describe('delays (SY-02b,c)', () => {
  it('push: 8 s debounce, but never later than 60 s after the first unsynced edit', () => {
    expect(pushDelay(0, 0)).toBe(8 * S)
    expect(pushDelay(50 * S, 0)).toBe(8 * S)
    expect(pushDelay(55 * S, 0)).toBe(5 * S)
    expect(pushDelay(70 * S, 0)).toBe(0)
  })

  it('backoff: 10 s doubling up to 5 min', () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(backoffDelay)).toEqual([10, 20, 40, 80, 160, 300, 300].map((x) => x * S))
  })

  it('rate limit: waits until x-ratelimit-reset, or retry-after', () => {
    const now = 1_700_000_000_000
    const h = (o: Record<string, string>) => new Headers(o)
    expect(
      retryAfter(403, h({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(now / 1000 + 120) }), now),
    ).toBe(120 * S)
    expect(retryAfter(429, h({ 'retry-after': '30' }), now)).toBe(30 * S)
    expect(retryAfter(403, h({ 'retry-after': '5' }), now)).toBe(5 * S) // secondary limit
    expect(retryAfter(403, h({ 'x-ratelimit-remaining': '12' }), now)).toBeNull() // plain permission error
    expect(retryAfter(500, h({}), now)).toBeNull()
  })
})

describe('scheduler', () => {
  let outcomes: SyncOutcome[]
  let calls: number
  let dirty: boolean
  const sync = vi.fn(async (): Promise<SyncOutcome> => {
    calls++
    return outcomes.shift() ?? { ok: true }
  })
  const make = () => createScheduler({ sync, hasDirty: () => dirty })
  const flush = async (ms: number) => {
    await vi.advanceTimersByTimeAsync(ms)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    outcomes = []
    calls = 0
    dirty = false
    sync.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('debounces edits and pushes 8 s after the last one', async () => {
    const s = make()
    dirty = true
    s.edited()
    await flush(5 * S)
    s.edited()
    await flush(7 * S)
    expect(calls).toBe(0)
    await flush(1 * S)
    expect(calls).toBe(1)
    s.dispose()
  })

  it('keeps typing for minutes: still pushes every 60 s', async () => {
    const s = make()
    dirty = true
    for (let t = 0; t < 130; t += 2) {
      s.edited()
      await flush(2 * S)
    }
    expect(calls).toBe(2) // at ~60 s and ~120 s
    s.dispose()
  })

  it('backs off after failures and resets after a success', async () => {
    const s = make()
    outcomes = [{ ok: false, error: new Error('net') }, { ok: false, error: new Error('net') }, { ok: true }]
    s.request('manual')
    await flush(0)
    expect(calls).toBe(1)
    s.request('interval') // blocked by backoff
    await flush(9 * S)
    expect(calls).toBe(1)
    await flush(1 * S) // retry at 10 s
    expect(calls).toBe(2)
    await flush(19 * S)
    expect(calls).toBe(2)
    await flush(1 * S) // retry at +20 s, succeeds
    expect(calls).toBe(3)
    expect(s.state().failures).toBe(0)
    s.request('interval')
    await flush(0)
    expect(calls).toBe(4)
    s.dispose()
  })

  it('online / visibility bypass a normal backoff but not a rate limit', async () => {
    const s = make()
    outcomes = [{ ok: false, error: new Error('offline') }]
    s.request('manual')
    await flush(0)
    s.request('online')
    await flush(0)
    expect(calls).toBe(2)

    outcomes = [{ ok: false, error: new Error('limit'), retryAfterMs: 120 * S }]
    s.request('manual')
    await flush(0)
    expect(calls).toBe(3)
    expect(s.state().blockedUntil).toBe(120 * S)
    s.request('online')
    s.request('hidden')
    s.request('manual')
    dirty = true
    s.edited()
    await flush(119 * S)
    expect(calls).toBe(3)
    await flush(1 * S)
    expect(calls).toBe(4)
    s.dispose()
  })

  it('does not retry errors marked final (expired login)', async () => {
    const s = make()
    outcomes = [{ ok: false, error: new Error('401'), final: true }]
    s.request('manual')
    await flush(10 * 60 * S)
    expect(calls).toBe(1)
    s.dispose()
  })

  it('never runs two syncs at once; a request during a sync runs once afterwards', async () => {
    let release!: () => void
    sync.mockImplementationOnce(
      () =>
        new Promise<SyncOutcome>((r) => {
          calls++
          release = () => r({ ok: true })
        }),
    )
    const s = make()
    s.request('manual')
    await flush(0)
    s.request('manual')
    s.request('interval')
    await flush(0)
    expect(calls).toBe(1)
    release()
    await flush(0)
    expect(calls).toBe(2)
    s.dispose()
  })
})
