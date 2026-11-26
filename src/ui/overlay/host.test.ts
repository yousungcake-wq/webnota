import { describe, expect, it } from 'vitest'
import { confirmDialog, dismissToast, hostStore, toast } from './host'

describe('overlay host', () => {
  it('confirmDialog resolves with the answer and removes itself', async () => {
    const p = confirmDialog({ message: 'sure?' })
    const req = hostStore.get().confirms.at(-1)!
    expect(req.message).toBe('sure?')
    req.resolve(true)
    await expect(p).resolves.toBe(true)
    expect(hostStore.get().confirms).toHaveLength(0)
  })

  it('keeps at most three toasts and dismisses by id or handle', () => {
    const handles = [1, 2, 3, 4].map((n) => toast(`t${n}`))
    expect(hostStore.get().toasts.map((t) => t.message)).toEqual(['t2', 't3', 't4'])
    handles[3]!()
    expect(hostStore.get().toasts.map((t) => t.message)).toEqual(['t2', 't3'])
    dismissToast(hostStore.get().toasts[0]!.id)
    expect(hostStore.get().toasts.map((t) => t.message)).toEqual(['t3'])
  })

  it('toasts with an action stay longer', () => {
    toast('plain')
    toast('undo', { action: { label: 'Undo', onClick: () => {} } })
    const [plain, undo] = hostStore.get().toasts.slice(-2)
    expect(undo!.duration).toBeGreaterThan(plain!.duration)
  })
})
