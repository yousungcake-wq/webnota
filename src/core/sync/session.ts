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
import { removeFiles } from './cleanup'
import { fileRefsInDoc, orphanFiles, orphanRowBodies } from '../files/refs'
import { getFile } from '../files/db'
import { listSpaces } from '../model/views'
import { FILES_DIRTY, type PendingFile } from './engine'
import type { SyncOutcome } from './schedule'
import { scopeStore, SPACE_ROOT_PATH, targetKey, type SyncTarget } from './targets'

function stateKey(a: Pick<Account, 'owner' | 'repo' | 'branch'>) {
  return `webnota:sync-state:${targetKey(a)}`
}

const loadSyncState = (key: string): SyncState => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? { headSha: null, blobs: {} }
  } catch {
    return { headSha: null, blobs: {} }
  }
}

/** Shared spaces (M9-01): their repositories, with each one's default branch (asked once, kept). */
async function sharedTargets(gh: GitHubClient, denied: string[]): Promise<SyncTarget[]> {
  const ws = await openDoc('workspace')
  const out: SyncTarget[] = []
  for (const s of listSpaces(ws)) {
    if (!s.repo || !s.repo.includes('/')) continue
    const [owner, repo] = s.repo.split('/', 2) as [string, string]
    const key = `webnota:branch:${s.repo}`
    let branch = localStorage.getItem(key)
    if (!branch) {
      const info = await gh.getRepo(owner, repo).catch(() => null)
      if (!info) {
        denied.push(s.id) // gone, or no longer shared with this account
        continue
      }
      branch = info.default_branch || 'main'
      localStorage.setItem(key, branch)
    }
    out.push({ spaceId: s.id, owner, repo, branch })
  }
  return out
}

/**
 * A shared space's store: its docs only; files its edited docs use go to its repository
 * too (members must be able to open them from that repository alone).
 */
function spaceStore(t: SyncTarget, releases: (() => void)[]) {
  const base = {
    getDoc: (name: string) => {
      releases.push(retainDoc(name))
      return openDoc(name)
    },
    getDirty,
    clearDirty,
  }
  const scoped = scopeStore(base, t.spaceId!, {
    load: () => loadSyncState(stateKey(t)),
    save: (s) => localStorage.setItem(stateKey(t), JSON.stringify(s)),
  })
  return {
    ...scoped,
    // edited docs may reference new files: let the engine look at them (no queue here)
    getDirty: () => {
      const d = scoped.getDirty()
      return Object.keys(d).length ? { ...d, [FILES_DIRTY]: 0 } : d
    },
    clearDirty: (name: string, gen: number) => {
      if (name !== FILES_DIRTY) scoped.clearDirty(name, gen)
    },
    pendingFiles: async (): Promise<PendingFile[]> => {
      const ids = new Set<string>()
      for (const name of Object.keys(scoped.getDirty())) fileRefsInDoc(await scoped.getDoc(name), ids)
      const out: PendingFile[] = []
      for (const id of ids) {
        const f = (await getFile('pending', id)) ?? (await getFile('cache', id))
        if (f) out.push({ id, bytes: f.bytes })
      }
      return out
    },
    filesUploaded: async () => {},
  }
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
    loadState: () => loadSyncState(stateKey(a)),
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
    const gh = new GitHubClient(token)
    const api = new GitHubGitApi(gh, account.owner, account.repo, account.branch)
    const started = performance.now()
    debugLog('sync', 'start', `${account.owner}/${account.repo}@${account.branch}`, 'dirty:', Object.keys(getDirty()))
    const result = await syncOnce(api, localStore(account, releases), {
      deviceName: deviceLabel(),
      canPush: () => !isReadOnly(),
    })
    // then every shared space with its own repository (SY-08); one that cannot be reached
    // only marks that space, the others go on
    const denied: string[] = []
    for (const t of await sharedTargets(gh, denied)) {
      try {
        const r = await syncOnce(new GitHubGitApi(gh, t.owner, t.repo, t.branch), spaceStore(t, releases), {
          deviceName: deviceLabel(),
          canPush: () => !isReadOnly(),
          rootPath: SPACE_ROOT_PATH,
        })
        result.pulled += r.pulled
        result.pushed += r.pushed
        result.deleted += r.deleted
      } catch (e) {
        if (e instanceof GitHubError && (e.status === 403 || e.status === 404)) denied.push(t.spaceId!)
        else throw e
      }
    }
    setSyncState({ deniedSpaces: denied })
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

/**
 * Removes repository files no document references (SY-04 cleanup, M3-10) and row page
 * bodies of deleted rows (M6-00), in one commit.
 */
export function cleanRepository(
  account: Account,
  token: string,
  referenced: Set<string>,
  rowsByDb: Map<string, Set<string>> = new Map(),
) {
  const api = new GitHubGitApi(new GitHubClient(token), account.owner, account.repo, account.branch)
  return removeFiles(api, (paths) => [...orphanFiles(paths, referenced), ...orphanRowBodies(paths, rowsByDb)], {
    deviceName: deviceLabel(),
  })
}

/** Repository size in bytes as GitHub reports it (`size`, KB — refreshed by GitHub with a delay). */
export async function repoSize(account: Account, token: string): Promise<number | null> {
  const repo = await new GitHubClient(token).getRepo(account.owner, account.repo)
  return repo ? repo.size * 1024 : null
}

/**
 * "Clean up repository history" (SY-03, M6-09): the current tree becomes a new root commit
 * and the branch is forced to it, so the old snapshots can be collected. Every device keeps
 * syncing (the engine compares file contents, not history). The head is read again right
 * before forcing, so a commit pushed meanwhile is not thrown away: then nothing changes.
 */
export async function squashHistory(account: Account, token: string): Promise<'done' | 'moved' | 'empty'> {
  const api = new GitHubGitApi(new GitHubClient(token), account.owner, account.repo, account.branch)
  const head = await api.getHead()
  if (!head) return 'empty'
  const root = await api.createCommit(
    `WebNota history cleanup${deviceLabel() ? ` from ${deviceLabel()}` : ''}`,
    head.treeSha,
    [],
  )
  const again = await api.getHead()
  if (again?.commitSha !== head.commitSha) return 'moved'
  await api.forceHead(root)
  return 'done'
}
