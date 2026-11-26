import { describe, expect, it } from 'vitest'
import { appendLog, type SyncLogEntry } from './log'

const ok = (at: number, n = 0): SyncLogEntry => ({ at, ok: true, pulled: n, pushed: 0, deleted: 0, ms: 10 })

describe('sync log (SY-02d)', () => {
  it('keeps the newest 50 entries, newest first', () => {
    let log: SyncLogEntry[] = []
    for (let i = 0; i < 60; i++) log = appendLog(log, ok(i, 1))
    expect(log).toHaveLength(50)
    expect(log[0]!.at).toBe(59)
    expect(log.at(-1)!.at).toBe(10)
  })

  it('folds consecutive no-change syncs into one entry with a count', () => {
    let log: SyncLogEntry[] = []
    log = appendLog(log, ok(1, 2))
    log = appendLog(log, ok(2))
    log = appendLog(log, ok(3))
    log = appendLog(log, ok(4))
    expect(log).toHaveLength(2)
    expect(log[0]).toMatchObject({ at: 4, repeat: 3, firstAt: 2 })
    log = appendLog(log, { at: 5, ok: false, pulled: 0, pushed: 0, deleted: 0, ms: 3, error: 'boom' })
    log = appendLog(log, ok(6))
    expect(log.map((e) => e.at)).toEqual([6, 5, 4, 1])
  })

  it('folds repeated identical errors too', () => {
    let log: SyncLogEntry[] = []
    const err = (at: number): SyncLogEntry => ({
      at,
      ok: false,
      pulled: 0,
      pushed: 0,
      deleted: 0,
      ms: 1,
      error: 'offline',
    })
    log = appendLog(appendLog(appendLog(log, err(1)), err(2)), err(3))
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ repeat: 3, error: 'offline' })
  })
})
