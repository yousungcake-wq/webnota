// The GitHub side of the sync controller: connecting an account and running one sync.
// Part of the lazy sync chunk (remote.ts) so the initial bundle only holds state and
// scheduling (controller.ts, spec/10 §1.1).
import { debugLog } from '../flags'
import { t } from '../i18n'
import { clearDirty, getDirty, openDoc, retainDoc } from '../docs/registry'
import { filesUploaded, pendingFiles } from '../files/upload'
import { isReadOnly } from '../schema/gate'
import { disconnect, saveAccount, setSyncState, type Account } from './controller'
import { ConflictRetryError, syncOnce, type LocalStore, type SyncState } from './engine'
import { GitHubClient, GitHubError, GitHubGitApi } from './github'
import { recordSync } from './log'
import type { SyncOutcome } from './schedule'

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
    pendingFiles,
    filesUploaded,
  }
}

/**
 * Validates a token and connects this workspace to a repository: `repo` (the user's own,
 * created private if missing) or `owner/repo` (someone else's, which must exist and
 * allow pushing — a repository shared with the user as a collaborator, WS-01).
 */
export async function connectAccount(token: string, target: string): Promise<Account> {
  const gh = new GitHubClient(token)
  const user = await gh.getUser()
  const [owner, repoName] = target.includes('/') ? (target.split('/', 2) as [string, string]) : [user.login, target]
  let repo = await gh.getRepo(owner, repoName)
  if (!repo && owner !== user.login) throw new Error(t('sync.err.repoNotFound', { repo: `${owner}/${repoName}` }))
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
    owner,
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
  await saveAccount(token, account)
  return account
}

/** One sync run (the controller has already checked account, token and connectivity). */
export async function runSession(account: Account, token: string): Promise<SyncOutcome> {
  const releases: (() => void)[] = []
  try {
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
    setSyncState({ status: Object.keys(getDirty()).length ? 'pending' : 'idle', lastSyncedAt: Date.now() })
    return { ok: true }
  } catch (e) {
    console.error('[webnota] sync failed', e)
    const isGh = e instanceof GitHubError
    recordSync({
      at: Date.now(),
      ok: false,
      pulled: 0,
      pushed: 0,
      deleted: 0,
      ms: 0,
      error: e instanceof Error ? `${isGh ? `${e.status} ` : ''}${e.message}` : String(e),
    })
    if (isGh && e.status === 401) {
      disconnect()
      setSyncState({ error: t('sync.err.expired') })
      return { ok: false, error: e, final: true }
    }
    setSyncState({
      status: navigator.onLine ? 'error' : 'offline',
      error: e instanceof ConflictRetryError ? t('sync.err.conflict') : e instanceof Error ? e.message : String(e),
    })
    return { ok: false, error: e, retryAfterMs: isGh ? e.retryAfterMs : null }
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

/** Downloads `files/<id>` from the connected repository (SY-04 display cache). */
export function downloadRepoFile(account: Account, token: string, id: string): Promise<Uint8Array | null> {
  return new GitHubClient(token).getRaw(account.owner, account.repo, `files/${id}`, account.branch)
}
