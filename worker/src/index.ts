/**
 * WebNota auth worker (Cloudflare Workers, free plan).
 *
 * Jobs:
 * - `POST /token`: exchange a GitHub OAuth `code` for an access token, which
 *   requires the client secret and can't be done from the browser (GitHub's
 *   token endpoint has no CORS support). The token is returned to the app and
 *   never stored here.
 * - `POST /refresh` (M9-02): a GitHub App user token expires after 8 hours; its refresh
 *   token (6 months) gets a new pair. Also needs the client secret. Nothing is stored here.
 * - `GET /unfurl?url=…` (ED-B21): title, description and image of a public page
 *   for link previews. Only allowed origins, only public http(s) hosts (SSRF
 *   checks on every redirect), HTML only, first 512KB, cached for a day.
 *
 * Secrets / vars (set with `wrangler secret put` / wrangler.toml):
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, ALLOWED_ORIGINS (comma separated)
 */

import { isFetchable, parseMeta } from './unfurl'

export interface Env {
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  ALLOWED_ORIGINS: string
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    const origin = req.headers.get('Origin') ?? ''
    const allowed = env.ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const originOk = allowed.includes(origin)
    const cors = originOk ? corsHeaders(origin) : {}

    if (url.pathname === '/' && req.method === 'GET') {
      return new Response('WebNota auth worker: ok', { headers: { 'Content-Type': 'text/plain' } })
    }
    if (url.pathname === '/unfurl') {
      if (req.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers: cors })
      if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, cors)
      if (!originOk) return json({ error: 'origin_not_allowed' }, 403, {})
      return unfurl(url.searchParams.get('url') ?? '', cors, ctx)
    }
    if (url.pathname === '/refresh') {
      if (req.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers: cors })
      if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors)
      if (!originOk) return json({ error: 'origin_not_allowed' }, 403, {})
      let rb: { refresh_token?: unknown }
      try {
        rb = await req.json()
      } catch {
        return json({ error: 'invalid_json' }, 400, cors)
      }
      if (typeof rb.refresh_token !== 'string' || !/^[A-Za-z0-9_.-]{1,512}$/.test(rb.refresh_token))
        return json({ error: 'invalid_refresh_token' }, 400, cors)
      return exchange(env, { grant_type: 'refresh_token', refresh_token: rb.refresh_token }, cors)
    }
    if (url.pathname !== '/token') return json({ error: 'not_found' }, 404, cors)
    if (req.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers: cors })
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors)
    if (!originOk) return json({ error: 'origin_not_allowed' }, 403, {})

    let body: { code?: unknown; redirect_uri?: unknown }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'invalid_json' }, 400, cors)
    }
    if (typeof body.code !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(body.code)) {
      return json({ error: 'invalid_code' }, 400, cors)
    }
    const redirectUri = typeof body.redirect_uri === 'string' ? body.redirect_uri : undefined
    if (redirectUri && !allowed.some((o) => redirectUri.startsWith(o + '/'))) {
      return json({ error: 'invalid_redirect_uri' }, 400, cors)
    }

    return exchange(env, { code: body.code, ...(redirectUri ? { redirect_uri: redirectUri } : {}) }, cors)
  },
}

/**
 * GitHub's token endpoint (an OAuth App or a GitHub App): a code or a refresh token for a
 * token. App user tokens come with `expires_in` and a `refresh_token`, passed on as is.
 */
async function exchange(env: Env, params: Record<string, string>, cors: Record<string, string>) {
  const gh = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'webnota-auth-worker' },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, ...params }),
  })
  const data = (await gh.json()) as Record<string, string | number>
  if (!gh.ok || data.error || !data.access_token) {
    return json({ error: data.error ?? 'exchange_failed', error_description: data.error_description }, 400, cors)
  }
  return json(
    {
      access_token: data.access_token,
      scope: data.scope,
      token_type: data.token_type,
      ...(data.refresh_token ? { refresh_token: data.refresh_token, expires_in: data.expires_in } : {}),
    },
    200,
    cors,
  )
}

const UNFURL_TTL = 86_400
const MAX_BYTES = 512 * 1024

async function unfurl(target: string, cors: Record<string, string>, ctx: ExecutionContext): Promise<Response> {
  let page = isFetchable(target)
  if (!page) return json({ error: 'invalid_url' }, 400, cors)
  const cacheKey = new Request(`https://unfurl.cache/${encodeURIComponent(page.href)}`)
  const cache = (caches as unknown as { default: Cache }).default
  const hit = await cache.match(cacheKey)
  if (hit) return json(await hit.json(), 200, cors)

  let res: Response | null = null
  for (let hop = 0; hop < 4; hop++) {
    res = await fetch(page.href, {
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'WebNotaBot/1.0 (link preview)', Accept: 'text/html,application/xhtml+xml' },
    })
    const loc = res.status >= 300 && res.status < 400 ? res.headers.get('Location') : null
    if (!loc) break
    const next = isFetchable(new URL(loc, page).href)
    if (!next) return json({ error: 'invalid_redirect' }, 400, cors)
    page = next
  }
  if (!res || !res.ok) return json({ error: 'fetch_failed', status: res?.status ?? 0 }, 502, cors)
  if (!/text\/html|application\/xhtml/i.test(res.headers.get('Content-Type') ?? '')) {
    const data = parseMeta('', page.href)
    return json(data, 200, cors)
  }
  // read at most MAX_BYTES: metadata lives in <head>
  const reader = res.body!.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    size += value.length
  }
  void reader.cancel()
  const buf = new Uint8Array(size)
  let off = 0
  for (const c of chunks) {
    buf.set(c.subarray(0, Math.min(c.length, size - off)), off)
    off += c.length
  }
  const data = parseMeta(new TextDecoder().decode(buf), page.href)
  ctx.waitUntil(
    cache.put(
      cacheKey,
      new Response(JSON.stringify(data), { headers: { 'Cache-Control': `public, max-age=${UNFURL_TTL}` } }),
    ),
  )
  return json(data, 200, cors)
}
