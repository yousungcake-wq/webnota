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

import { t } from '../i18n'

const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string | undefined
const PROXY = (import.meta.env.VITE_AUTH_PROXY_URL as string | undefined)?.replace(/\/$/, '')
const TOKEN_KEY = 'webnota:gh-token'
const STATE_KEY = 'webnota:oauth-state'
/** GitHub App user tokens (M9-02): the refresh token and when the access token expires. */
const REFRESH_KEY = 'webnota:gh-refresh'
const EXPIRES_KEY = 'webnota:gh-expires'
/** The GitHub App's public page name, for "install / choose repositories" (M9-02). */
export const APP_SLUG = (import.meta.env.VITE_GITHUB_APP_SLUG as string | undefined) || null

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
  else {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(EXPIRES_KEY)
  }
}

export interface TokenGrant {
  access_token: string
  /** GitHub App user tokens: seconds until the access token expires (8 hours). */
  expires_in?: number
  refresh_token?: string
}

/** Stores a token from the exchange or a refresh; App tokens keep their refresh token and expiry. */
export function saveGrant(g: TokenGrant, now = Date.now()) {
  localStorage.setItem(TOKEN_KEY, g.access_token)
  if (g.refresh_token && g.expires_in) {
    localStorage.setItem(REFRESH_KEY, g.refresh_token)
    localStorage.setItem(EXPIRES_KEY, String(now + g.expires_in * 1000))
  } else {
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(EXPIRES_KEY)
  }
}

/** Refresh this long before expiry, so a sync never starts with a token about to lapse. */
const EARLY_MS = 5 * 60 * 1000

/**
 * The access token, refreshed first when it is a GitHub App token close to expiring
 * (M9-02, spec/06 SY-06). PATs and OAuth App tokens do not expire: returned as they are.
 * A failed refresh keeps the old token (the next API call then reports 401).
 */
export async function freshToken(
  now = Date.now(),
  fetcher: typeof fetch = fetch,
  proxy = PROXY,
): Promise<string | null> {
  const token = getToken()
  const refresh = localStorage.getItem(REFRESH_KEY)
  const expires = Number(localStorage.getItem(EXPIRES_KEY) || 0)
  if (!token || !refresh || !expires || !proxy || expires - now > EARLY_MS) return token
  try {
    const res = await fetcher(`${proxy}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    const data = (await res.json()) as TokenGrant & { error?: string }
    if (!res.ok || !data.access_token) return token
    saveGrant(data, now)
    return data.access_token
  } catch {
    return token
  }
}

/** True when the token is a GitHub App user token (refreshable, limited to the repositories the user picked). */
export const isAppToken = () => Boolean(localStorage.getItem(REFRESH_KEY))

/** GitHub's page to install the app or change which repositories it may use. */
export const appInstallUrl = () => (APP_SLUG ? `https://github.com/apps/${APP_SLUG}/installations/new` : null)

export function startLogin() {
  if (!oauthAvailable) throw new Error(t('auth.err.noOauth'))
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
    throw new Error(t('auth.err.state'))
  }
  try {
    const res = await fetch(`${PROXY}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: redirectUri() }),
    })
    const data = (await res.json()) as Partial<TokenGrant> & { error?: string; error_description?: string }
    if (!res.ok || !data.access_token) throw new Error(data.error_description || data.error || t('auth.err.exchange'))
    saveGrant(data as TokenGrant)
    return data.access_token
  } finally {
    clean()
  }
}
