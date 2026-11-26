import { t } from '../i18n'
import { base64ToBytes, bytesToBase64 } from './encoding'
import type { GitApi, TreeEntry } from './engine'
import { retryAfter } from './schedule'

const API = 'https://api.github.com'

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Set for rate-limit responses: how long to wait before the next request (SY-02c). */
    public retryAfterMs: number | null = null,
  ) {
    super(message)
  }
}

/**
 * ETag cache for conditional GETs (SY-02h): a 304 answer does not count against the rate
 * limit. Module-level because a client is created per sync. Blobs and trees are
 * addressed by sha (immutable, large) and are not cached here.
 */
const etags = new Map<string, { etag: string; body: unknown }>()
const MAX_ETAGS = 50

export function clearEtagCache() {
  etags.clear()
}

const conditional = (method: string, path: string) =>
  method === 'GET' && !path.includes('/git/blobs/') && !path.includes('/git/trees/')

export class GitHubClient {
  constructor(private token: string) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const key = `${this.token.slice(-8)} ${path}`
    const cached = conditional(method, path) ? etags.get(key) : undefined
    const res = await fetch(`${API}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cached ? { 'If-None-Match': cached.etag } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.status === 304) {
      if (cached) return cached.body as T
      throw new GitHubError(304, 'Not Modified without a cached response')
    }
    if (!res.ok) {
      let msg = res.statusText
      try {
        msg = ((await res.json()) as { message?: string }).message ?? msg
      } catch {
        /* not JSON */
      }
      throw new GitHubError(res.status, msg, retryAfter(res.status, res.headers, Date.now()))
    }
    if (res.status === 204) return undefined as T
    const data = (await res.json()) as T
    const etag = res.headers.get('etag')
    if (etag && conditional(method, path)) {
      etags.delete(key)
      etags.set(key, { etag, body: data })
      if (etags.size > MAX_ETAGS) etags.delete(etags.keys().next().value!)
    }
    return data
  }

  getUser() {
    return this.request<{ login: string; name: string | null; avatar_url: string }>('GET', '/user')
  }

  async getRepo(owner: string, repo: string) {
    try {
      return await this.request<{ default_branch: string; private: boolean; size: number; full_name: string }>(
        'GET',
        `/repos/${owner}/${repo}`,
      )
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return null
      throw e
    }
  }

  createRepo(name: string) {
    return this.request<{ default_branch: string; full_name: string }>('POST', '/user/repos', {
      name,
      private: true,
      auto_init: true,
      description: t('sync.repoDescription'),
    })
  }

  /** The Git Data API refuses to work on an empty repository; seed it with a README. */
  initEmptyRepo(owner: string, repo: string) {
    return this.request('PUT', `/repos/${owner}/${repo}/contents/README.md`, {
      message: 'Initialize WebNota data repository',
      content: bytesToBase64(new TextEncoder().encode(t('sync.repoReadme'))),
    })
  }
}

export class GitHubGitApi implements GitApi {
  constructor(
    private gh: GitHubClient,
    private owner: string,
    private repo: string,
    private branch: string,
  ) {}

  private get base() {
    return `/repos/${this.owner}/${this.repo}/git`
  }

  async getHead() {
    let ref: { object: { sha: string } }
    try {
      ref = await this.gh.request('GET', `${this.base}/ref/heads/${encodeURIComponent(this.branch)}`)
    } catch (e) {
      if (e instanceof GitHubError && (e.status === 404 || e.status === 409)) return null
      throw e
    }
    const commit = await this.gh.request<{ tree: { sha: string } }>('GET', `${this.base}/commits/${ref.object.sha}`)
    return { commitSha: ref.object.sha, treeSha: commit.tree.sha }
  }

  async getTree(treeSha: string): Promise<TreeEntry[]> {
    const res = await this.gh.request<{ tree: { path: string; sha: string; type: string }[]; truncated: boolean }>(
      'GET',
      `${this.base}/trees/${treeSha}?recursive=1`,
    )
    if (res.truncated) console.warn('[webnota] tree listing truncated by GitHub')
    return res.tree.filter((e) => e.type === 'blob').map(({ path, sha }) => ({ path, sha }))
  }

  async getBlob(sha: string) {
    const res = await this.gh.request<{ content: string; encoding: string }>('GET', `${this.base}/blobs/${sha}`)
    return base64ToBytes(res.content)
  }

  async createBlob(bytes: Uint8Array) {
    const res = await this.gh.request<{ sha: string }>('POST', `${this.base}/blobs`, {
      content: bytesToBase64(bytes),
      encoding: 'base64',
    })
    return res.sha
  }

  async createTree(baseTree: string | null, entries: { path: string; sha: string | null }[]) {
    const res = await this.gh.request<{ sha: string }>('POST', `${this.base}/trees`, {
      ...(baseTree ? { base_tree: baseTree } : {}),
      tree: entries.map((e) => ({ path: e.path, mode: '100644', type: 'blob', sha: e.sha })),
    })
    return res.sha
  }

  async createCommit(message: string, treeSha: string, parents: string[]) {
    const res = await this.gh.request<{ sha: string }>('POST', `${this.base}/commits`, {
      message,
      tree: treeSha,
      parents,
    })
    return res.sha
  }

  async updateHead(commitSha: string, create: boolean) {
    try {
      if (create) {
        await this.gh.request('POST', `${this.base}/refs`, { ref: `refs/heads/${this.branch}`, sha: commitSha })
      } else {
        await this.gh.request('PATCH', `${this.base}/refs/heads/${encodeURIComponent(this.branch)}`, {
          sha: commitSha,
          force: false,
        })
      }
      return true
    } catch (e) {
      // 422 = not a fast-forward (another device pushed first)
      if (e instanceof GitHubError && e.status === 422) return false
      throw e
    }
  }
}
