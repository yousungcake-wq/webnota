/**
 * WebNota auth worker (Cloudflare Workers, free plan).
 *
 * Its only job: exchange a GitHub OAuth `code` for an access token, which
 * requires the client secret and can't be done from the browser (GitHub's
 * token endpoint has no CORS support). The token is returned to the app and
 * never stored here.
 *
 * Secrets / vars (set with `wrangler secret put` / wrangler.toml):
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, ALLOWED_ORIGINS (comma separated)
 */

export interface Env {
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  ALLOWED_ORIGINS: string
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  async fetch(req: Request, env: Env): Promise<Response> {
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

    const gh = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'webnota-auth-worker' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code: body.code,
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      }),
    })
    const data = (await gh.json()) as Record<string, string>
    if (!gh.ok || data.error || !data.access_token) {
      return json({ error: data.error ?? 'exchange_failed', error_description: data.error_description }, 400, cors)
    }
    return json({ access_token: data.access_token, scope: data.scope, token_type: data.token_type }, 200, cors)
  },
}
