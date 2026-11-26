import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearEtagCache, GitHubClient, GitHubError } from './github'

type Call = { url: string; headers: Record<string, string> }

describe('GitHubClient conditional requests (SY-02h)', () => {
  let calls: Call[]
  let responses: Response[]

  beforeEach(() => {
    calls = []
    responses = []
    clearEtagCache()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, headers: init.headers as Record<string, string> })
        return responses.shift()!
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  const json = (body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...headers } })

  it('sends If-None-Match with the last ETag and serves 304 from the cache', async () => {
    const gh = new GitHubClient('t')
    responses.push(json({ object: { sha: 'a' } }, { etag: 'W/"1"' }))
    expect(await gh.request('GET', '/repos/o/r/git/ref/heads/main')).toEqual({ object: { sha: 'a' } })
    expect(calls[0]!.headers['If-None-Match']).toBeUndefined()

    responses.push(new Response(null, { status: 304 }))
    // a new client (one is created per sync) still uses the cache
    expect(await new GitHubClient('t').request('GET', '/repos/o/r/git/ref/heads/main')).toEqual({
      object: { sha: 'a' },
    })
    expect(calls[1]!.headers['If-None-Match']).toBe('W/"1"')

    responses.push(json({ object: { sha: 'b' } }, { etag: 'W/"2"' }))
    expect(await gh.request('GET', '/repos/o/r/git/ref/heads/main')).toEqual({ object: { sha: 'b' } })
    responses.push(new Response(null, { status: 304 }))
    await gh.request('GET', '/repos/o/r/git/ref/heads/main')
    expect(calls[3]!.headers['If-None-Match']).toBe('W/"2"')
  })

  it('does not cache blobs, trees or writes, and keeps caches per token', async () => {
    const gh = new GitHubClient('t')
    responses.push(json({ content: '', encoding: 'base64' }, { etag: '"b"' }))
    await gh.request('GET', '/repos/o/r/git/blobs/abc')
    responses.push(json({ content: '', encoding: 'base64' }))
    await gh.request('GET', '/repos/o/r/git/blobs/abc')
    expect(calls[1]!.headers['If-None-Match']).toBeUndefined()

    responses.push(json({ login: 'me' }, { etag: '"u"' }))
    await gh.request('GET', '/user')
    responses.push(json({ login: 'other' }))
    await new GitHubClient('other-token').request('GET', '/user')
    expect(calls[3]!.headers['If-None-Match']).toBeUndefined()
  })

  it('a 304 without a cached body is an error, not undefined data', async () => {
    responses.push(new Response(null, { status: 304 }))
    await expect(new GitHubClient('t').request('GET', '/user')).rejects.toBeInstanceOf(GitHubError)
  })
})
