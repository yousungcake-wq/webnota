import { afterEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createTabRelay, TAB_ORIGIN, type TabRelay } from './tabs'

const wait = () => new Promise((r) => setTimeout(r, 20))
const relays: TabRelay[] = []
function tab(channel: string) {
  const docs = new Map<string, Y.Doc>()
  const relay = createTabRelay(channel, (n) => docs.get(n))
  relays.push(relay)
  const open = (name: string) => {
    const d = new Y.Doc()
    docs.set(name, d)
    relay.attach(name, d)
    return d
  }
  return { relay, open, docs }
}
afterEach(() => relays.splice(0).forEach((r) => r.close()))

describe('tab relay (SY-02e)', () => {
  it('forwards local edits of a doc to other tabs that have it open', async () => {
    const a = tab('c1')
    const b = tab('c1')
    const da = a.open('doc/x')
    const db = b.open('doc/x')
    const origins: unknown[] = []
    db.on('update', (_u: Uint8Array, o: unknown) => origins.push(o))
    da.getText('t').insert(0, 'from a')
    await wait()
    expect(db.getText('t').toString()).toBe('from a')
    expect(origins).toEqual([TAB_ORIGIN])
    // no echo back
    db.getText('t').insert(0, '> ')
    await wait()
    expect(da.getText('t').toString()).toBe('> from a')
  })

  it('does not forward updates whose origin is skipped (loaded from IndexedDB)', async () => {
    const a = tab('c2')
    const b = tab('c2')
    const db = b.open('doc/x')
    const da = new Y.Doc()
    a.docs.set('doc/x', da)
    const persistence = {}
    a.relay.attach('doc/x', da, [persistence])
    da.transact(() => da.getText('t').insert(0, 'from disk'), persistence)
    await wait()
    expect(db.getText('t').toString()).toBe('')
  })

  it('ignores docs the other tab has not opened, and other channels', async () => {
    const a = tab('c3')
    const b = tab('c3')
    const other = tab('c4')
    const da = a.open('doc/only-a')
    const dOther = other.open('doc/only-a')
    da.getText('t').insert(0, 'x')
    await wait()
    expect(b.docs.size).toBe(0)
    expect(dOther.getText('t').toString()).toBe('')
  })

  it('carries other messages', async () => {
    const a = tab('c5')
    const b = tab('c5')
    const got: unknown[] = []
    b.relay.on('sync-request', (m) => got.push(m))
    a.relay.post({ type: 'sync-request' })
    await wait()
    expect(got).toEqual([{ type: 'sync-request' }])
  })
})
