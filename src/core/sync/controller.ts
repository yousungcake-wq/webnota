import { debugLog } from '../flags'
import { t } from '../i18n'
import { getToken, setToken } from '../auth/auth'
import { clearDirty, getDirty, markDirty, onDirtyChange, openDoc, pageDocName } from '../docs/registry'
import { listPages } from '../model/pages'
import { createStore } from '../store/createStore'
import { isReadOnly } from '../schema/gate'
import { ConflictRetryError, syncOnce, type LocalStore, type SyncState } from './engine'
import { GitHubClient, GitHubError, GitHubGitApi } from './github'

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
const PUSH_DEBOUNCE_MS = 8_000
const PULL_INTERVAL_MS = 60_000

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

function localStore(a: Account): LocalStore {
  return {
    getDoc: openDoc,
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

/** Validates a token, creates the private data repo if needed, and stores the account. */
export async function connect(token: string, repoName = DEFAULT_REPO): Promise<Account> {
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
  // Everything that exists locally must be uploaded at least once.
  await markAllDirtyForFirstSync()
  void syncNow()
  return account
}

async function markAllDirtyForFirstSync() {
  const ws = await openDoc('workspace')
  markDirty('workspace')
  for (const p of listPages(ws)) markDirty(pageDocName(p.id))
}

export function disconnect() {
  setToken(null)
  localStorage.removeItem(ACCOUNT_KEY)
  set({ account: null, status: 'disconnected', error: null, lastSyncedAt: null })
}

let running: Promise<void> | null = null
let again = false

export function syncNow(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      await runSync()
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

async function runSync() {
  const account = syncStore.get().account
  const token = getToken()
  if (!account || !token) {
    set({ status: 'disconnected' })
    return
  }
  if (!navigator.onLine) {
    set({ status: 'offline' })
    return
  }
  set({ status: 'syncing', error: null })
  try {
    const api = new GitHubGitApi(new GitHubClient(token), account.owner, account.repo, account.branch)
    const started = performance.now()
    debugLog('sync', 'start', `${account.owner}/${account.repo}@${account.branch}`, 'dirty:', Object.keys(getDirty()))
    const result = await syncOnce(api, localStore(account), {
      deviceName: deviceLabel(),
      canPush: () => !isReadOnly(),
    })
    debugLog('sync', 'done', result, `${Math.round(performance.now() - started)}ms`)
    set({ status: Object.keys(getDirty()).length ? 'pending' : 'idle', lastSyncedAt: Date.now() })
  } catch (e) {
    console.error('[webnota] sync failed', e)
    if (e instanceof GitHubError && e.status === 401) {
      disconnect()
      set({ error: t('sync.err.expired') })
      return
    }
    set({
      status: navigator.onLine ? 'error' : 'offline',
      error: e instanceof ConflictRetryError ? t('sync.err.conflict') : e instanceof Error ? e.message : String(e),
    })
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

/** Wires up automatic syncing: debounced push after edits, periodic pull, push when the app is hidden. */
export function startAutoSync() {
  if (started) return
  started = true
  let timer: ReturnType<typeof setTimeout> | null = null

  onDirtyChange(() => {
    if (!syncStore.get().account) return
    if (Object.keys(getDirty()).length === 0) return
    if (syncStore.get().status === 'idle') set({ status: 'pending' })
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void syncNow(), PUSH_DEBOUNCE_MS)
  })

  setInterval(() => {
    if (syncStore.get().account && document.visibilityState === 'visible') void syncNow()
  }, PULL_INTERVAL_MS)

  document.addEventListener('visibilitychange', () => {
    if (!syncStore.get().account) return
    // hidden: flush pending edits before the OS may kill the tab; visible: pull fresh changes
    void syncNow()
  })
  window.addEventListener('online', () => void syncNow())
  window.addEventListener('offline', () => syncStore.get().account && set({ status: 'offline' }))

  if (syncStore.get().account) {
    set({ status: 'idle' })
    void syncNow()
  }
}
