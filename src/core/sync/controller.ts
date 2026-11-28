import { debugLog } from '../flags'
import { freshToken, getToken, setToken } from '../auth/auth'
import { getDirty, markDirty, onDirtyChange, openDoc, pageDocName, tabs } from '../docs/registry'
import { currentWorkspaceId, wsKey } from '../docs/slots'
import { adoptFavorites, listViews, referencedDatabaseIds, setCurrentUser } from '../model/views'
import { databaseDocNames } from '../model/database/shard'
import { createStore } from '../store/createStore'
import { isReadOnly } from '../schema/gate'
import { electLeader } from './leader'
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
  /** Shared spaces whose repository this account can no longer reach (M9-01): read-only here. */
  deniedSpaces?: string[]
}

const ACCOUNT_KEY = wsKey('account')
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

/** State updates; also used by the lazy `session.ts`. */
export function setSyncState(patch: Partial<ControllerState>) {
  set(patch)
}

function set(patch: Partial<ControllerState>) {
  syncStore.set((s) => ({ ...s, ...patch }))
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
    const adopted = wsKey(`adopted:${login}`)
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

/** Repository a new workspace should connect to once a token exists (`owner/repo` or `repo`). */
const TARGET_KEY = () => wsKey('connect-target')
export function setPendingTarget(target: string, slot?: Parameters<typeof wsKey>[1]) {
  localStorage.setItem(wsKey('connect-target', slot), target)
}
export function pendingTarget(): string | null {
  try {
    return localStorage.getItem(TARGET_KEY())
  } catch {
    return null
  }
}

/**
 * Validates a token and connects this workspace to a repository (WS-01). The GitHub work
 * lives in the lazy sync chunk (`session.ts`): devices that never connect never load it.
 */
export async function connect(token: string, target?: string): Promise<Account> {
  return (await remote()).connectAccount(token, target ?? pendingTarget() ?? DEFAULT_REPO)
}

/** Called by `session.ts` once the account is verified. */
export async function saveAccount(token: string, account: Account) {
  setToken(token)
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
  localStorage.removeItem(TARGET_KEY())
  set({ account, status: 'idle', error: null })
  await applyLogin(account.login)
  // Everything that exists locally must be uploaded at least once.
  const ws = await openDoc('workspace')
  markDirty('workspace')
  for (const p of listViews(ws)) markDirty(pageDocName(p.id))
  // databases (M4-02): schema + every shard, even untouched ones (the engine skips identical blobs)
  for (const dbId of referencedDatabaseIds(ws)) databaseDocNames(dbId).forEach(markDirty)
  // row page bodies (M5-08): read from the shards, loaded only here
  const { rowBodyDocNames } = await import('../docs/database')
  for (const dbId of referencedDatabaseIds(ws)) (await rowBodyDocNames(dbId)).forEach(markDirty)
  requestSync('manual')
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
  try {
    // GitHub App tokens last 8 hours: renew before a sync rather than fail it (M9-02)
    return await (await remote()).runSession(account, (await freshToken()) ?? token)
  } catch (e) {
    // the sync chunk itself failed to load (offline, new deploy)
    set({ status: navigator.onLine ? 'error' : 'offline', error: e instanceof Error ? e.message : String(e) })
    return { ok: false, error: e, retryAfterMs: null }
  }
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
