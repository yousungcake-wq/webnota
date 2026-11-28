import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { initSpaceDoc, spaceViews } from '../model/space'
import { createView } from '../model/views'
import { spaceDocName } from '../docs/spaceDocs'
import { syncOnce, type SyncState } from './engine'
import { scopeStore, SPACE_ROOT_PATH, spaceOfDoc } from './targets'

/** A tiny in-memory repository (same contract as the engine tests' fake). */
class Repo {
  blobs = new Map<string, Uint8Array>()
  trees = new Map<string, Map<string, string>>()
  commits = new Map<string, { tree: string; parents: string[] }>()
  head: string | null = null
  n = 0
  async getHead() {
    return this.head ? { commitSha: this.head, treeSha: this.commits.get(this.head)!.tree } : null
  }
  async getTree(sha: string) {
    return [...this.trees.get(sha)!].map(([path, s]) => ({ path, sha: s }))
  }
  async getBlob(sha: string) {
    return this.blobs.get(sha)!
  }
  async createBlob(bytes: Uint8Array) {
    const sha = `b${++this.n}`
    this.blobs.set(sha, bytes)
    return sha
  }
  async createTree(base: string | null, entries: { path: string; sha: string | null }[]) {
    const t = new Map(base ? this.trees.get(base) : [])
    for (const e of entries) {
      if (e.sha) t.set(e.path, e.sha)
      else t.delete(e.path)
    }
    const sha = `t${++this.n}`
    this.trees.set(sha, t)
    return sha
  }
  async createCommit(_m: string, tree: string, parents: string[]) {
    const sha = `c${++this.n}`
    this.commits.set(sha, { tree, parents })
    return sha
  }
  async updateHead(commit: string, create: boolean) {
    const parent = this.commits.get(commit)!.parents[0] ?? null
    if (create ? this.head !== null : parent !== this.head) return false
    this.head = commit
    return true
  }
  files() {
    return this.head ? [...this.trees.get(this.commits.get(this.head)!.tree)!.keys()].sort() : []
  }
}

/** A device's whole local store: every doc of every space, one dirty set. */
class Device {
  docs = new Map<string, Y.Doc>()
  dirty: Record<string, number> = {}
  states = new Map<string, SyncState>()
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
  scoped(spaceId: string) {
    return scopeStore(this, spaceId, {
      load: () => structuredClone(this.states.get(spaceId) ?? { headSha: null, blobs: {} }),
      save: (s) => this.states.set(spaceId, structuredClone(s)),
    })
  }
}

describe('sync targets: a shared space syncs with its own repository (M9-01)', () => {
  it('only the space docs go to the space repository, under their plain paths', async () => {
    const repo = new Repo()
    const a = new Device()
    const space = a.doc(spaceDocName('s1', 'space'))
    initSpaceDoc(space, { id: 's1', name: '팀', schemaVersion: 26 })
    const page = createView(space, { spaceId: 's1', title: '공유 문서' })
    a.doc(spaceDocName('s1', `doc/${page}`))
      .getText('t')
      .insert(0, '같이 쓰는 글')
    // a home doc stays out of the space repository
    createView(a.doc('workspace'), { title: '개인' })

    const r = await syncOnce(repo, a.scoped('s1'), { rootPath: SPACE_ROOT_PATH })
    expect(r.pushed).toBe(2)
    expect(repo.files()).toEqual([`data/docs/${page}.yjs`, SPACE_ROOT_PATH])
    expect(Object.keys(a.dirty)).toEqual(['workspace']) // the home doc is still dirty, the space's are not

    // a member's device gets the whole space from that repository alone
    const b = new Device()
    await syncOnce(repo, b.scoped('s1'), { rootPath: SPACE_ROOT_PATH })
    expect(spaceViews(b.doc(spaceDocName('s1', 'space'))).map((v) => v.title)).toEqual(['공유 문서'])
    expect(
      b
        .doc(spaceDocName('s1', `doc/${page}`))
        .getText('t')
        .toString(),
    ).toBe('같이 쓰는 글')
    expect(b.dirty).toEqual({})

    // both edit, both sync: merged
    b.doc(spaceDocName('s1', `doc/${page}`))
      .getText('t')
      .insert(0, 'B: ')
    a.doc(spaceDocName('s1', `doc/${page}`))
      .getText('t')
      .insert(6, ' (A)')
    await syncOnce(repo, b.scoped('s1'), { rootPath: SPACE_ROOT_PATH })
    await syncOnce(repo, a.scoped('s1'), { rootPath: SPACE_ROOT_PATH })
    await syncOnce(repo, b.scoped('s1'), { rootPath: SPACE_ROOT_PATH })
    const ta = a
      .doc(spaceDocName('s1', `doc/${page}`))
      .getText('t')
      .toString()
    expect(ta).toContain('B: ')
    expect(ta).toContain(' (A)')
    expect(
      b
        .doc(spaceDocName('s1', `doc/${page}`))
        .getText('t')
        .toString(),
    ).toBe(ta)
  })

  it('docs know their target', () => {
    expect(spaceOfDoc('sp:s1:doc/x')).toBe('s1')
    expect(spaceOfDoc('doc/x')).toBeNull()
    expect(spaceOfDoc('workspace')).toBeNull()
  })
})
