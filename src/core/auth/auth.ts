/**
 * GitHub sign-in for a static site.
 *
 * GitHub's token endpoint needs the OAuth client secret and does not allow
 * browser (CORS) requests, so the code -> token exchange goes through a tiny
 * Cloudflare Worker (see /worker). Everything else talks to api.github.com
 * directly from the browser.
 *
 * Fallback: a fine-grained personal access token pasted in Settings.
 */

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined
const PROXY = (import.meta.env.VITE_AUTH_PROXY_URL as string | undefined)?.replace(/\/$/, '')
const TOKEN_KEY = 'webnota:gh-token'
const STATE_KEY = 'webnota:oauth-state'

export const oauthAvailable = Boolean(CLIENT_ID && PROXY)

export function redirectUri() {
  return `${location.origin}${import.meta.env.BASE_URL}`
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function startLogin() {
  if (!oauthAvailable) throw new Error('OAuth가 설정되지 않았습니다.')
  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_KEY, state)
  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', CLIENT_ID!)
  url.searchParams.set('redirect_uri', redirectUri())
  // `repo` is required to create and write a private repository with an OAuth App.
  url.searchParams.set('scope', 'repo')
  url.searchParams.set('state', state)
  url.searchParams.set('allow_signup', 'true')
  location.assign(url.toString())
}

/** Handles the ?code=&state= redirect from GitHub. Returns the token if a login just completed. */
export async function completeLoginFromUrl(): Promise<string | null> {
  const params = new URLSearchParams(location.search)
  const code = params.get('code')
  const state = params.get('state')
  if (!code) return null

  const clean = () => {
    const url = new URL(location.href)
    url.searchParams.delete('code')
    url.searchParams.delete('state')
    history.replaceState(null, '', url.toString())
  }

  const expected = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)
  if (!expected || expected !== state) {
    clean()
    throw new Error('로그인 요청을 확인할 수 없습니다. 다시 시도하세요.')
  }
  try {
    const res = await fetch(`${PROXY}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: redirectUri() }),
    })
    const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string }
    if (!res.ok || !data.access_token) throw new Error(data.error_description || data.error || '토큰 교환 실패')
    setToken(data.access_token)
    return data.access_token
  } finally {
    clean()
  }
}
