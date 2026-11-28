import { createHash } from 'node:crypto'
import type { Page, Route } from '@playwright/test'

/** One repository: content-addressed objects, branch `main`, fast-forward-only ref updates. */
export class FakeRepo {
  blobs = new Map<string, Buffer>()
  trees = new Map<string, Map<string, string>>()
  commits = new Map<string, { tree: string; parents: string[]; message: string }>()
  head: string
  collaborators = new Set<string>()
  private n = 0

  constructor(
    readonly owner: string,
    readonly name: string,
    readonly isPrivate = true,
  ) {
    const readme = this.putBlob(Buffer.from('# data\n'))
    const tree = this.putTree(new Map([['README.md', readme]]))
    this.head = this.putCommit(tree, [], 'init')
  }
  get fullName() {
    return `${this.owner}/${this.name}`
  }
  private sha(prefix: string) {
    return createHash('sha1').update(`${this.fullName}${prefix}${++this.n}`).digest('hex')
  }
  putBlob(b: Buffer) {
    const s = this.sha('b')
    this.blobs.set(s, b)
    return s
  }
  putTree(t: Map<string, string>) {
    const s = this.sha('t')
    this.trees.set(s, t)
    return s
  }
  putCommit(tree: string, parents: string[], message: string) {
    const s = this.sha('c')
    this.commits.set(s, { tree, parents, message })
    return s
  }
  /** Paths of the current tree, sorted. */
  files() {
    return [...this.trees.get(this.commits.get(this.head)!.tree)!.keys()].sort()
  }
  canAccess(login: string) {
    return login === this.owner || this.collaborators.has(login)
  }
}

/** Repositories shared by every account of a test (two people, one GitHub). */
export class FakeServer {
  repos = new Map<string, FakeRepo>()
  repo(fullName: string) {
    return this.repos.get(fullName)
  }
  ensure(owner: string, name: string, isPrivate = true) {
    const key = `${owner}/${name}`
    let r = this.repos.get(key)
    if (!r) this.repos.set(key, (r = new FakeRepo(owner, name, isPrivate)))
    return r
  }
}

/**
 * In-memory GitHub (REST + Git Data API subset the app uses) for e2e tests: the account
 * `login` (default `tester`) with its repository `<login>/webnota-data`; more repositories
 * and accounts share a `FakeServer`. The old single-repository API (`blobs`, `files()`,
 * `head`, `commits`) points at the home repository.
 */
export class FakeGithub {
  readonly server: FakeServer
  readonly login: string
  readonly home: FakeRepo

  constructor(opts: { login?: string; server?: FakeServer } = {}) {
    this.server = opts.server ?? new FakeServer()
    this.login = opts.login ?? 'tester'
    this.home = this.server.ensure(this.login, 'webnota-data')
  }
  get blobs() {
    return this.home.blobs
  }
  get commits() {
    return this.home.commits
  }
  get head() {
    return this.home.head
  }
  files() {
    return this.home.files()
  }

  async install(page: Page) {
    await page.route('https://api.github.com/**', (route) => this.handle(route))
  }

  private async handle(route: Route) {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname
    const method = req.method()
    const ok = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'ETag' },
        body: JSON.stringify(body),
      })
    if (method === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      })
    const body = () => JSON.parse(req.postData() || '{}') as Record<string, unknown>

    if (p === '/user') return ok({ login: this.login, name: null, avatar_url: '' })
    if (p === '/user/repos' && method === 'POST') {
      const b = body() as { name: string; private?: boolean }
      const r = this.server.ensure(this.login, b.name, b.private !== false)
      return ok({ default_branch: 'main', full_name: r.fullName }, 201)
    }
    const rm = /^\/repos\/([^/]+)\/([^/]+)(\/.*)?$/.exec(p)
    if (!rm) return ok({ message: `fake github: ${method} ${p} not handled` }, 404)
    const repo = this.server.repo(`${rm[1]}/${rm[2]}`)
    if (!repo || !repo.canAccess(this.login)) return ok({ message: 'Not Found' }, 404)
    const rest = rm[3] ?? ''

    if (rest === '') return ok({ default_branch: 'main', private: repo.isPrivate, size: 1, full_name: repo.fullName })
    if (rest === '/git/ref/heads/main') return ok({ object: { sha: repo.head } })
    let m = /^\/git\/commits\/(\w+)$/.exec(rest)
    if (m && method === 'GET') return ok({ sha: m[1], tree: { sha: repo.commits.get(m[1]!)!.tree } })
    m = /^\/git\/trees\/(\w+)$/.exec(rest)
    if (m && method === 'GET')
      return ok({
        truncated: false,
        tree: [...repo.trees.get(m[1]!)!].map(([path, sha]) => ({ path, sha, type: 'blob' })),
      })
    m = /^\/git\/blobs\/(\w+)$/.exec(rest)
    if (m && method === 'GET') return ok({ content: repo.blobs.get(m[1]!)!.toString('base64'), encoding: 'base64' })
    if (rest === '/git/blobs' && method === 'POST') {
      return ok({ sha: repo.putBlob(Buffer.from(body().content as string, 'base64')) }, 201)
    }
    if (rest === '/git/trees' && method === 'POST') {
      const b = body() as { base_tree?: string; tree: { path: string; sha: string | null }[] }
      const t = new Map(b.base_tree ? repo.trees.get(b.base_tree) : [])
      for (const e of b.tree) {
        if (e.sha) t.set(e.path, e.sha)
        else t.delete(e.path)
      }
      return ok({ sha: repo.putTree(t) }, 201)
    }
    if (rest === '/git/commits' && method === 'POST') {
      const b = body() as { tree: string; parents: string[]; message: string }
      return ok({ sha: repo.putCommit(b.tree, b.parents, b.message) }, 201)
    }
    if (rest === '/git/refs/heads/main' && method === 'PATCH') {
      const sha = body().sha as string
      const force = body().force === true
      if (!force && repo.commits.get(sha)?.parents[0] !== repo.head)
        return ok({ message: 'Update is not a fast forward' }, 422)
      repo.head = sha
      return ok({ object: { sha } })
    }
    m = /^\/contents\/(.+)$/.exec(rest)
    if (m && method === 'GET') {
      const blob = repo.trees.get(repo.commits.get(repo.head)!.tree)!.get(decodeURIComponent(m[1]!))
      if (!blob) return ok({ message: 'Not Found' }, 404)
      return route.fulfill({
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: repo.blobs.get(blob)!,
      })
    }
    return ok({ message: `fake github: ${method} ${p} not handled` }, 404)
  }
}

/** Connects the open app to the fake repository with a token (settings → PAT). */
export async function connectFake(page: Page, login = 'tester') {
  await page.goto('/#/settings')
  // the token form is open when OAuth is not configured (as in tests)
  await page.getByLabel('토큰').fill('github_pat_test')
  await page.getByRole('button', { name: '연결', exact: true }).click()
  await page.locator('code', { hasText: `${login}/webnota-data` }).waitFor()
}
