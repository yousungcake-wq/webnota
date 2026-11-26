import { describe, expect, it } from 'vitest'
import { electLeader } from './leader'

/** Minimal LockManager: exclusive locks granted in request order, released when the callback's promise settles. */
class FakeLocks {
  private queues = new Map<string, (() => void)[]>()
  private held = new Set<string>()
  request(name: string, cb: () => Promise<unknown>) {
    return new Promise((resolve) => {
      const run = () => {
        this.held.add(name)
        void cb().then((v) => {
          this.held.delete(name)
          resolve(v)
          this.queues.get(name)?.shift()?.()
        })
      }
      if (this.held.has(name)) this.queues.set(name, [...(this.queues.get(name) ?? []), run])
      else run()
    })
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('electLeader (SY-02e)', () => {
  it('exactly one tab leads; the next one takes over when it goes away', async () => {
    const locks = new FakeLocks()
    const events: string[] = []
    const a = electLeader('k', () => events.push('a'), locks)
    const b = electLeader('k', () => events.push('b'), locks)
    await tick()
    expect(events).toEqual(['a'])
    expect(a.isLeader()).toBe(true)
    expect(b.isLeader()).toBe(false)
    a.resign() // tab closed
    await tick()
    expect(events).toEqual(['a', 'b'])
    expect(b.isLeader()).toBe(true)
  })

  it('without the Web Locks API every tab leads (previous behaviour)', async () => {
    const events: string[] = []
    const a = electLeader('k', () => events.push('a'), null)
    await tick()
    expect(a.isLeader()).toBe(true)
    expect(events).toEqual(['a'])
  })
})
