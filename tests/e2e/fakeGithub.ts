import { createHash } from 'node:crypto'
import type { Page, Route } from '@playwright/test'

/**
 * In-memory GitHub (REST + Git Data API subset the app uses) for e2e tests: one user
 * `tester`, one repository `tester/webnota-data`, branch `main`, fast-forward-only refs.
 */
export class FakeGithub {
  blobs = new Map<string, Buffer>()
  trees = new Map<string, Map<string, string>>()
  commits = new Map<string, { tree: string; parents: string[]; message: string }>()
  head: string
  private n = 0

  constructor() {
    const readme = this.putBlob(Buffer.from('# data\n'))
    const tree = this.putTree(new Map([['README.md', readme]]))
    this.head = this.putCommit(tree, [], 'init')
  }

  private sha(prefix: string) {
    return createHash('sha1').update(`${prefix}${++this.n}`).digest('hex')
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
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      })
    const body = () => JSON.parse(req.postData() || '{}') as Record<string, unknown>
    const base = '/repos/tester/webnota-data'

    if (p === '/user') return ok({ login: 'tester', name: null, avatar_url: '' })
    if (p === base) return ok({ default_branch: 'main', private: true, size: 1, full_name: 'tester/webnota-data' })
    if (p === `${base}/git/ref/heads/main`) return ok({ object: { sha: this.head } })
    let m = /^\/repos\/tester\/webnota-data\/git\/commits\/(\w+)$/.exec(p)
    if (m && method === 'GET') return ok({ sha: m[1], tree: { sha: this.commits.get(m[1]!)!.tree } })
    m = /^\/repos\/tester\/webnota-data\/git\/trees\/(\w+)$/.exec(p)
    if (m && method === 'GET')
      return ok({
        truncated: false,
        tree: [...this.trees.get(m[1]!)!].map(([path, sha]) => ({ path, sha, type: 'blob' })),
      })
    m = /^\/repos\/tester\/webnota-data\/git\/blobs\/(\w+)$/.exec(p)
    if (m && method === 'GET') return ok({ content: this.blobs.get(m[1]!)!.toString('base64'), encoding: 'base64' })
    if (p === `${base}/git/blobs` && method === 'POST') {
      return ok({ sha: this.putBlob(Buffer.from(body().content as string, 'base64')) }, 201)
    }
    if (p === `${base}/git/trees` && method === 'POST') {
      const b = body() as { base_tree?: string; tree: { path: string; sha: string | null }[] }
      const t = new Map(b.base_tree ? this.trees.get(b.base_tree) : [])
      for (const e of b.tree) {
        if (e.sha) t.set(e.path, e.sha)
        else t.delete(e.path)
      }
      return ok({ sha: this.putTree(t) }, 201)
    }
    if (p === `${base}/git/commits` && method === 'POST') {
      const b = body() as { tree: string; parents: string[]; message: string }
      return ok({ sha: this.putCommit(b.tree, b.parents, b.message) }, 201)
    }
    if (p === `${base}/git/refs/heads/main` && method === 'PATCH') {
      const sha = body().sha as string
      const force = body().force === true
      if (!force && this.commits.get(sha)?.parents[0] !== this.head)
        return ok({ message: 'Update is not a fast forward' }, 422)
      this.head = sha
      return ok({ object: { sha } })
    }
    m = /^\/repos\/tester\/webnota-data\/contents\/(.+)$/.exec(p)
    if (m && method === 'GET') {
      const blob = this.trees.get(this.commits.get(this.head)!.tree)!.get(decodeURIComponent(m[1]!))
      if (!blob) return ok({ message: 'Not Found' }, 404)
      return route.fulfill({
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: this.blobs.get(blob)!,
      })
    }
    return ok({ message: `fake github: ${method} ${p} not handled` }, 404)
  }
}

/** Connects the open app to the fake repository with a token (settings → PAT). */
export async function connectFake(page: Page) {
  await page.goto('/#/settings')
  // the token form is open when OAuth is not configured (as in tests)
  await page.getByLabel('토큰').fill('github_pat_test')
  await page.getByRole('button', { name: '연결', exact: true }).click()
  await page.locator('code', { hasText: 'tester/webnota-data' }).waitFor()
}
