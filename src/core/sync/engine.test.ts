import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createPage, deletePagePermanently, listPages, updatePage } from '../model/pages'
import { gitBlobSha } from './encoding'
import { syncOnce, type GitApi, type LocalStore, type SyncState } from './engine'

/** In-memory imitation of GitHub's Git Data API (fast-forward-only ref updates). */
class FakeRemote implements GitApi {
  blobs = new Map<string, Uint8Array>()
  trees = new Map<string, Map<string, string>>()
  commits = new Map<string, { tree: string; parents: string[] }>()
  head: string | null = null
  requests = 0
  /** called right before updateHead: lets a test simulate another device pushing */
  beforeUpdateHead: (() => Promise<void>) | null = null
  private n = 0

  async getHead() {
    this.requests++
    if (!this.head) return null
    return { commitSha: this.head, treeSha: this.commits.get(this.head)!.tree }
  }
  async getTree(sha: string) {
    this.requests++
    return [...this.trees.get(sha)!].map(([path, s]) => ({ path, sha: s }))
  }
  async getBlob(sha: string) {
    this.requests++
    return this.blobs.get(sha)!
  }
  async createBlob(bytes: Uint8Array) {
    this.requests++
    const sha = await gitBlobSha(bytes)
    this.blobs.set(sha, bytes)
    return sha
  }
  async createTree(base: string | null, entries: { path: string; sha: string | null }[]) {
    this.requests++
    const t = new Map(base ? this.trees.get(base) : [])
    for (const e of entries) {
      if (e.sha) t.set(e.path, e.sha)
      else t.delete(e.path)
    }
    const sha = `tree${++this.n}`
    this.trees.set(sha, t)
    return sha
  }
  async createCommit(_m: string, tree: string, parents: string[]) {
    this.requests++
    const sha = `commit${++this.n}`
    this.commits.set(sha, { tree, parents })
    return sha
  }
  async updateHead(commit: string, create: boolean) {
    this.requests++
    if (this.beforeUpdateHead) {
      const hook = this.beforeUpdateHead
      this.beforeUpdateHead = null
      await hook()
    }
    const parent = this.commits.get(commit)!.parents[0] ?? null
    if (create ? this.head !== null : parent !== this.head) return false
    this.head = commit
    return true
  }
  files() {
    return this.head ? [...this.trees.get(this.commits.get(this.head)!.tree)!.keys()].sort() : []
  }
}

/** A device: its own docs, dirty set and sync state — mirrors src/store/docs.ts. */
class Device implements LocalStore {
  docs = new Map<string, Y.Doc>()
  dirty: Record<string, number> = {}
  state: SyncState = { headSha: null, blobs: {} }

  async getDoc(name: string) {
    return this.doc(name)
  }
  doc(name: string) {
    let d = this.docs.get(name)
    if (!d) {
      d = new Y.Doc()
      d.on('update', (_u: Uint8Array, origin: unknown) => {
        if (origin !== 'webnota-remote') this.dirty[name] = (this.dirty[name] ?? 0) + 1
      })
      this.docs.set(name, d)
    }
    return d
  }
  getDirty() {
    return this.dirty
  }
  clearDirty(name: string, gen: number) {
    if (this.dirty[name] === gen) delete this.dirty[name]
  }
  loadState() {
    return structuredClone(this.state)
  }
  saveState(s: SyncState) {
    this.state = structuredClone(s)
  }
  get ws() {
    return this.doc('workspace')
  }
  text(id: string) {
    return this.doc(`doc/${id}`).getText('t').toString()
  }
  type(id: string, at: number, s: string) {
    this.doc(`doc/${id}`).getText('t').insert(at, s)
  }
}

describe('sync engine', () => {
  it('uploads a new workspace and pulls it on another device', async () => {
    const remote = new FakeRemote()
    const a = new Device()
    const b = new Device()
    const id = createPage(a.ws, { title: '회의록' })
    a.type(id, 0, '안녕하세요')

    const r1 = await syncOnce(remote, a)
    expect(r1.pushed).toBe(2)
    expect(remote.files()).toEqual(['data/pages/' + id + '.yjs', 'data/workspace.yjs'])
    expect(a.dirty).toEqual({})

    const r2 = await syncOnce(remote, b)
    expect(r2.pulled).toBe(2)
    expect(r2.pushed).toBe(0)
    expect(listPages(b.ws).map((p) => p.title)).toEqual(['회의록'])
    expect(b.text(id)).toBe('안녕하세요')
    expect(b.dirty).toEqual({}) // remote updates must not mark docs dirty
  })

  it('does a single cheap request when nothing changed', async () => {
    const remote = new FakeRemote()
    const a = new Device()
    createPage(a.ws, { title: 'x' })
    await syncOnce(remote, a)
    remote.requests = 0
    await syncOnce(remote, a)
    expect(remote.requests).toBe(1)
  })

  it('merges concurrent edits from two devices without losing anything', async () => {
    const remote = new FakeRemote()
    const a = new Device()
    const b = new Device()
    const id = createPage(a.ws, { title: '공유 문서' })
    a.type(id, 0, 'base')
    await syncOnce(remote, a)
    await syncOnce(remote, b)

    // both edit offline
    a.type(id, 0, 'A-')
    updatePage(a.ws, id, { title: '제목 A' })
    b.type(id, 4, '-B')
    updatePage(b.ws, id, { favorite: true })
    const idB = createPage(b.ws, { title: 'B의 새 페이지' })

    await syncOnce(remote, a)
    await syncOnce(remote, b) // B pulls A's changes, merges, pushes
    await syncOnce(remote, a) // A pulls the merge

    for (const d of [a, b]) {
      expect(d.text(id)).toBe('A-base-B')
      const p = listPages(d.ws).find((x) => x.id === id)!
      expect(p.title).toBe('제목 A')
      expect(p.favorite).toBe(true)
      expect(listPages(d.ws).some((x) => x.id === idB)).toBe(true)
    }
  })

  it('retries when another device pushes between read and ref update', async () => {
    const remote = new FakeRemote()
    const a = new Device()
    const b = new Device()
    const id = createPage(a.ws, { title: 'race' })
    await syncOnce(remote, a)
    await syncOnce(remote, b)

    a.type(id, 0, 'from A')
    b.type(id, 0, 'from B ')
    remote.beforeUpdateHead = async () => {
      await syncOnce(remote, b) // B sneaks in a commit
    }
    const r = await syncOnce(remote, a)
    expect(r.attempts).toBe(2)
    await syncOnce(remote, b)

    expect(a.text(id)).toBe(b.text(id))
    expect(a.text(id)).toContain('from A')
    expect(a.text(id)).toContain('from B')
  })

  it('keeps edits made while a sync is in flight dirty', async () => {
    const remote = new FakeRemote()
    const a = new Device()
    const id = createPage(a.ws, { title: 't' })
    remote.beforeUpdateHead = async () => {
      a.type(id, 0, 'typed during sync')
    }
    await syncOnce(remote, a)
    expect(a.dirty[`doc/${id}`]).toBeGreaterThan(0)
    await syncOnce(remote, a)
    expect(a.dirty).toEqual({})
    const b = new Device()
    await syncOnce(remote, b)
    expect(b.text(id)).toBe('typed during sync')
  })

  it('removes files of permanently deleted pages', async () => {
    const remote = new FakeRemote()
    const a = new Device()
    const b = new Device()
    const parent = createPage(a.ws, { title: 'parent' })
    const child = createPage(a.ws, { title: 'child', parentId: parent })
    a.type(parent, 0, 'p')
    a.type(child, 0, 'x')
    await syncOnce(remote, a)
    await syncOnce(remote, b)

    deletePagePermanently(a.ws, parent)
    const r = await syncOnce(remote, a)
    expect(r.deleted).toBe(2)
    expect(remote.files()).toEqual(['data/workspace.yjs'])

    // a stale device editing the deleted page must not resurrect its file
    b.type(child, 0, 'late edit')
    await syncOnce(remote, b)
    expect(remote.files()).toEqual(['data/workspace.yjs'])
    expect(listPages(b.ws)).toEqual([])
  })
  it('pulls but does not push while canPush() is false (schema read-only gate)', async () => {
    const remote = new FakeRemote()
    const a = new Device()
    const b = new Device()
    createPage(a.ws, { title: 'from a' })
    await syncOnce(remote, a)
    const headBefore = remote.head

    createPage(b.ws, { title: 'local on b' })
    const r = await syncOnce(remote, b, { canPush: () => false })
    expect(r.pulled).toBe(1)
    expect(r.pushed).toBe(0)
    expect(remote.head).toBe(headBefore)
    expect(Object.keys(b.dirty)).toEqual(['workspace']) // stays dirty for later

    // the gate is checked after the pull, so a newer version pulled in that round blocks the push
    let pulledYet = false
    const c = new Device()
    createPage(c.ws, { title: 'local on c' })
    c.ws.on('update', (_u: Uint8Array, origin: unknown) => {
      if (origin === 'webnota-remote') pulledYet = true
    })
    await syncOnce(remote, c, { canPush: () => !pulledYet })
    expect(remote.head).toBe(headBefore)
  })
})
