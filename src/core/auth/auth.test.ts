import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})

const { freshToken, getToken, isAppToken, saveGrant, setToken } = await import('./auth')

describe('GitHub App user tokens (M9-02)', () => {
  beforeEach(() => store.clear())

  it('a PAT / OAuth token is used as is', async () => {
    setToken('pat')
    const fetcher = vi.fn()
    expect(await freshToken(0, fetcher, 'https://w')).toBe('pat')
    expect(fetcher).not.toHaveBeenCalled()
    expect(isAppToken()).toBe(false)
  })

  it('an App token far from expiry is used; near expiry it is refreshed through the worker', async () => {
    saveGrant({ access_token: 'a1', expires_in: 8 * 3600, refresh_token: 'r1' }, 0)
    expect(isAppToken()).toBe(true)
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ access_token: 'a2', expires_in: 8 * 3600, refresh_token: 'r2' }),
    })) as unknown as typeof fetch
    expect(await freshToken(3600_000, fetcher, 'https://w')).toBe('a1')
    expect(fetcher).not.toHaveBeenCalled()
    const late = 8 * 3600_000 - 60_000
    expect(await freshToken(late, fetcher, 'https://w')).toBe('a2')
    expect(fetcher).toHaveBeenCalledWith('https://w/refresh', expect.objectContaining({ method: 'POST' }))
    expect(getToken()).toBe('a2')
    // the new pair is kept: the next check is far from expiry again
    expect(await freshToken(late + 1000, fetcher, 'https://w')).toBe('a2')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('a failed refresh keeps the old token', async () => {
    saveGrant({ access_token: 'a1', expires_in: 60, refresh_token: 'r1' }, 0)
    const fetcher = vi.fn(async () => ({ ok: false, json: async () => ({ error: 'bad_refresh_token' }) }))
    expect(await freshToken(30_000, fetcher as unknown as typeof fetch, 'https://w')).toBe('a1')
    setToken(null)
    expect(isAppToken()).toBe(false)
  })
})
