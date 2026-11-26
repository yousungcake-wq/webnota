import { debugLog } from '../flags'
import { t } from '../i18n'
import { getToken, setToken } from '../auth/auth'
import { clearDirty, getDirty, markDirty, onDirtyChange, openDoc, pageDocName, retainDoc, tabs } from '../docs/registry'
import { currentWorkspaceId } from '../docs/slots'
import { adoptFavorites, listViews, setCurrentUser } from '../model/views'
import { createStore } from '../store/createStore'
import { isReadOnly } from '../schema/gate'
import type { LocalStore, SyncState } from './engine'
import { electLeader } from './leader'
import { recordSync } from './log'
import { createScheduler, PULL_INTERVAL_MS, type SyncOutcome, type SyncReason } from './schedule'

export type SyncStatus = 'disconnected' | 'idle' | 'pending' | 'syncing' | 'offline' | 'error'

export interface Account {
  login: string
  avatarUrl: string
  owner: string
  repo: string
  branch: string
}

export interface ControllerState {
  status: SyncStatus
  account: Account | null
  lastSyncedAt: number | null
  error: string | null
}

const ACCOUNT_KEY = 'webnota:account'
const DEFAULT_REPO = 'webnota-data'

/** Read in React with `useSync()` (core/store/sync.ts). */
export const syncStore = createStore<ControllerState>({
  status: 'disconnected',
  account: readAccount(),
  lastSyncedAt: null,
  error: null,
})

function readAccount(): Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY)
    return raw && getToken() ? (JSON.parse(raw) as Account) : null
  } catch {
    return null
  }
}

function set(patch: Partial<ControllerState>) {
  syncStore.set((s) => ({ ...s, ...patch }))
}

function stateKey(a: Account) {
  return `webnota:sync-state:${a.owner}/${a.repo}@${a.branch}`
}

/** `releases` collects retains: docs the engine touches stay loaded until the sync ends (SY-01 LRU). */
function localStore(a: Account, releases: (() => void)[]): LocalStore {
  return {
    getDoc: (name) => {
      releases.push(retainDoc(name))
      return openDoc(name)
    },
    getDirty,
    clearDirty,
    loadState: () => {
      try {
        return JSON.parse(localStorage.getItem(stateKey(a)) || 'null') ?? { headSha: null, blobs: {} }
      } catch {
        return { headSha: null, blobs: {} }
      }
    },
    saveState: (s: SyncState) => localStorage.setItem(stateKey(a), JSON.stringify(s)),
  }
}

const remote = () => import('./remote')

const LOGIN_KEY = 'webnota:login'

/**
 * Per-user state (favorites) is keyed by the GitHub login once it is known (spec/02 §8).
 * The last login is remembered so disconnecting does not hide the user's favorites.
 * Favorites made before connecting (under `local`) are merged in once per login.
 */
async function applyLogin(login: string) {
  setCurrentUser(login)
  try {
    localStorage.setItem(LOGIN_KEY, login)
    const adopted = `webnota:adopted:${login}`
    if (isReadOnly() || localStorage.getItem(adopted)) return
    adoptFavorites(await openDoc('workspace'), 'local')
    localStorage.setItem(adopted, '1')
  } catch {
    /* storage unavailable: retried next boot */
  }
}

/** Boot: apply the connected (or last) login before the UI reads per-user state. */
export async function initUser() {
  let login = syncStore.get().account?.login ?? null
  try {
    login ??= localStorage.getItem(LOGIN_KEY)
  } catch {
    /* no storage */
  }
  if (login) await applyLogin(login)
}

/** Validates a token, creates the private data repo if needed, and stores the account. */
export async function connect(token: string, repoName = DEFAULT_REPO): Promise<Account> {
  const { GitHubClient, GitHubError, GitHubGitApi } = await remote()
  const gh = new GitHubClient(token)
  const user = await gh.getUser()
  let repo = await gh.getRepo(user.login, repoName)
  if (!repo) {
    try {
      repo = await gh.createRepo(repoName).then((r) => ({ ...r, private: true, size: 0 }))
    } catch (e) {
      if (e instanceof GitHubError && (e.status === 403 || e.status === 404)) {
        throw new Error(t('sync.err.noRepoPermission', { repo: repoName }), { cause: e })
      }
      throw e
    }
  }
  const account: Account = {
    login: user.login,
    avatarUrl: user.avatar_url,
    owner: user.login,
    repo: repoName,
    branch: repo!.default_branch || 'main',
  }
  // A brand-new repo (or one created empty by the user) has no commits yet.
  const api = new GitHubGitApi(gh, account.owner, account.repo, account.branch)
  let head = await api.getHead()
  for (let i = 0; !head && i < 4; i++) {
    if (i === 0 && repo!.size === 0) {
      try {
        await gh.initEmptyRepo(account.owner, account.repo)
      } catch {
        /* auto_init may still be in progress */
      }
    }
    await new Promise((r) => setTimeout(r, 800 * (i + 1)))
    head = await api.getHead()
  }
  setToken(token)
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
  set({ account, status: 'idle', error: null })
  await applyLogin(account.login)
  // Everything that exists locally must be uploaded at least once.
  await markAllDirtyForFirstSync()
  requestSync('manual')
  return account
}

async function markAllDirtyForFirstSync() {
  const ws = await openDoc('workspace')
  markDirty('workspace')
  for (const p of listViews(ws)) markDirty(pageDocName(p.id))
}

export function disconnect() {
  setToken(null)
  localStorage.removeItem(ACCOUNT_KEY)
  set({ account: null, status: 'disconnected', error: null, lastSyncedAt: null })
}

const scheduler = createScheduler({ sync: runSync, hasDirty: () => Object.keys(getDirty()).length > 0 })

/**
 * Only the leader tab syncs (SY-02e); other tabs forward their requests to it. Edits made
 * in any tab reach the leader's docs live through the tab relay (core/docs/tabs.ts) and
 * its dirty set through the `storage` event.
 */
let election: { isLeader: () => boolean } | null = null

function requestSync(reason: SyncReason) {
  if (election?.isLeader() ?? true) scheduler.request(reason)
  else tabs.post({ type: 'sync-request', reason })
}

/** Manual sync (button). Respects a rate-limit wait, bypasses a normal backoff (SY-02c). */
export function syncNow() {
  requestSync('manual')
}

async function runSync(): Promise<SyncOutcome> {
  const account = syncStore.get().account
  const token = getToken()
  if (!account || !token) {
    set({ status: 'disconnected' })
    return { ok: true }
  }
  if (!navigator.onLine) {
    set({ status: 'offline' })
    return { ok: true } // the 'online' event triggers the next attempt
  }
  set({ status: 'syncing', error: null })
  const releases: (() => void)[] = []
  let net: Awaited<ReturnType<typeof remote>> | undefined
  try {
    net = await remote()
    const { GitHubClient, GitHubGitApi, syncOnce } = net
    const api = new GitHubGitApi(new GitHubClient(token), account.owner, account.repo, account.branch)
    const started = performance.now()
    debugLog('sync', 'start', `${account.owner}/${account.repo}@${account.branch}`, 'dirty:', Object.keys(getDirty()))
    const result = await syncOnce(api, localStore(account, releases), {
      deviceName: deviceLabel(),
      canPush: () => !isReadOnly(),
    })
    const ms = Math.round(performance.now() - started)
    debugLog('sync', 'done', result, `${ms}ms`)
    recordSync({ at: Date.now(), ok: true, pulled: result.pulled, pushed: result.pushed, deleted: result.deleted, ms })
    set({ status: Object.keys(getDirty()).length ? 'pending' : 'idle', lastSyncedAt: Date.now() })
    return { ok: true }
  } catch (e) {
    console.error('[webnota] sync failed', e)
    const GitHubError = net?.GitHubError
    const isGh = (x: unknown): x is InstanceType<NonNullable<typeof GitHubError>> =>
      !!GitHubError && x instanceof GitHubError
    recordSync({
      at: Date.now(),
      ok: false,
      pulled: 0,
      pushed: 0,
      deleted: 0,
      ms: 0,
      error: e instanceof Error ? `${isGh(e) ? `${e.status} ` : ''}${e.message}` : String(e),
    })
    if (isGh(e) && e.status === 401) {
      disconnect()
      set({ error: t('sync.err.expired') })
      return { ok: false, error: e, final: true }
    }
    set({
      status: navigator.onLine ? 'error' : 'offline',
      error:
        net && e instanceof net.ConflictRetryError
          ? t('sync.err.conflict')
          : e instanceof Error
            ? e.message
            : String(e),
    })
    return { ok: false, error: e, retryAfterMs: isGh(e) ? e.retryAfterMs : null }
  } finally {
    releases.forEach((r) => r())
  }
}

function deviceLabel() {
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Mac/i.test(ua)) return 'macOS'
  if (/Windows/i.test(ua)) return 'Windows'
  return 'Web'
}

let started = false

/** Wires up automatic syncing (SY-02b,e): pushes after edits, periodic pull, on hide/show and reconnect. */
export function startAutoSync() {
  if (started) return
  started = true

  onDirtyChange(() => {
    if (!syncStore.get().account) return
    if (Object.keys(getDirty()).length === 0) return
    if (syncStore.get().status === 'idle') set({ status: 'pending' })
    if (election?.isLeader()) scheduler.edited()
  })

  setInterval(() => {
    if (syncStore.get().account && document.visibilityState === 'visible') requestSync('interval')
  }, PULL_INTERVAL_MS)

  document.addEventListener('visibilitychange', () => {
    if (!syncStore.get().account) return
    // hidden: flush pending edits before the OS may kill the tab; visible: pull fresh changes
    requestSync(document.visibilityState === 'hidden' ? 'hidden' : 'visible')
  })
  window.addEventListener('online', () => requestSync('online'))
  window.addEventListener('offline', () => syncStore.get().account && set({ status: 'offline' }))

  // Login/logout in another tab.
  window.addEventListener('storage', (e) => {
    if (e.key === ACCOUNT_KEY) set({ account: readAccount() })
  })

  tabs.on('sync-request', (m) => {
    if (!election?.isLeader()) return
    const account = readAccount() // the request may come right after a login in that tab
    if (account?.repo !== syncStore.get().account?.repo) set({ account })
    scheduler.request(m.reason as SyncReason)
  })
  // Followers mirror the leader's status.
  tabs.on('status', (m) => {
    if (election?.isLeader()) return
    set({
      status: m.status as SyncStatus,
      lastSyncedAt: m.lastSyncedAt as number | null,
      error: m.error as string | null,
    })
  })
  syncStore.subscribe(() => {
    if (!election?.isLeader()) return
    const { status, lastSyncedAt, error } = syncStore.get()
    tabs.post({ type: 'status', status, lastSyncedAt, error })
  })

  election = electLeader(`webnota:sync-leader:${currentWorkspaceId()}`, () => {
    debugLog('sync', 'this tab is the sync leader')
    if (!syncStore.get().account) return
    set({ status: Object.keys(getDirty()).length ? 'pending' : 'idle' })
    scheduler.request('start')
    if (Object.keys(getDirty()).length) scheduler.edited()
  })
  if (syncStore.get().account) set({ status: 'idle' })
}
