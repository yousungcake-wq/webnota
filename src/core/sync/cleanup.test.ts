import { describe, expect, it } from 'vitest'
import { removeFiles } from './cleanup'
import type { GitApi } from './engine'

/** Tiny fast-forward-only repository. */
function repo(initial: string[]) {
  let n = 0
  const trees = new Map<string, Set<string>>([['t0', new Set(initial)]])
  const commits = new Map<string, { tree: string; parent: string | null }>([['c0', { tree: 't0', parent: null }]])
  const state = { head: 'c0', beforeUpdate: null as null | (() => void) }
  const api: GitApi = {
    getHead: async () => ({ commitSha: state.head, treeSha: commits.get(state.head)!.tree }),
    getTree: async (sha) => [...trees.get(sha)!].map((path) => ({ path, sha: 'x' })),
    getBlob: async () => new Uint8Array(),
    createBlob: async () => 'b',
    createTree: async (base, entries) => {
      const t = new Set(trees.get(base!)!)
      for (const e of entries) {
        if (e.sha) t.add(e.path)
        else t.delete(e.path)
      }
      const sha = `t${++n}`
      trees.set(sha, t)
      return sha
    },
    createCommit: async (_m, tree, parents) => {
      const sha = `c${++n}`
      commits.set(sha, { tree, parent: parents[0] ?? null })
      return sha
    },
    updateHead: async (commit) => {
      state.beforeUpdate?.()
      state.beforeUpdate = null
      if (commits.get(commit)!.parent !== state.head) return false
      state.head = commit
      return true
    },
  }
  const files = () => [...trees.get(commits.get(state.head)!.tree)!].sort()
  /** Another device commits a new file. */
  const push = (path: string) => {
    const t = new Set(trees.get(commits.get(state.head)!.tree)!)
    t.add(path)
    trees.set(`t${++n}`, t)
    commits.set(`c${n}`, { tree: `t${n}`, parent: state.head })
    state.head = `c${n}`
  }
  return { api, files, state, push }
}

const unused = (keep: string[]) => (paths: string[]) => paths.filter((p) => p.startsWith('files/') && !keep.includes(p))

describe('repository cleanup (SY-04, M3-10)', () => {
  it('removes the picked files in one commit and reports what stayed', async () => {
    const r = repo(['data/workspace.yjs', 'files/a.png', 'files/b.png', 'files/c.png'])
    const res = await removeFiles(r.api, unused(['files/a.png']))
    expect(res).toEqual({ removed: ['files/b.png', 'files/c.png'], kept: 1 })
    expect(r.files()).toEqual(['data/workspace.yjs', 'files/a.png'])
  })
  it('nothing to remove: no commit', async () => {
    const r = repo(['files/a.png'])
    const head = r.state.head
    expect(await removeFiles(r.api, unused(['files/a.png']))).toEqual({ removed: [], kept: 1 })
    expect(r.state.head).toBe(head)
  })
  it('re-decides on the new head when another device pushed meanwhile', async () => {
    const r = repo(['files/a.png', 'files/old.png'])
    r.state.beforeUpdate = () => r.push('files/new.png')
    const seen: string[][] = []
    const res = await removeFiles(r.api, (paths) => {
      seen.push(paths)
      return paths.includes('files/old.png') ? ['files/old.png'] : []
    })
    expect(seen).toHaveLength(2) // second look includes the other device's file
    expect(res.removed).toEqual(['files/old.png'])
    expect(r.files()).toEqual(['files/a.png', 'files/new.png'])
  })
})
