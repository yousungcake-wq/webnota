import type { GitApi } from './engine'

export interface CleanupResult {
  /** Paths removed from the repository. */
  removed: string[]
  /** Files under files/ that are still used. */
  kept: number
}

/**
 * Removes unused files from the repository in one commit (SY-04 cleanup, M3-10).
 * `pick` gets every path of the current tree and returns those to delete; it runs again
 * on the new head when another device pushed in between (fast-forward only, like sync).
 */
export async function removeFiles(
  api: GitApi,
  pick: (paths: string[]) => string[],
  opts: { deviceName?: string; maxAttempts?: number } = {},
): Promise<CleanupResult> {
  for (let attempt = 0; attempt < (opts.maxAttempts ?? 3); attempt++) {
    const head = await api.getHead()
    if (!head) return { removed: [], kept: 0 }
    const paths = (await api.getTree(head.treeSha)).map((e) => e.path)
    const removed = pick(paths)
    const kept = paths.filter((p) => p.startsWith('files/')).length - removed.length
    if (!removed.length) return { removed, kept }
    const tree = await api.createTree(
      head.treeSha,
      removed.map((path) => ({ path, sha: null })),
    )
    const msg = `WebNota cleanup${opts.deviceName ? ` from ${opts.deviceName}` : ''}: remove ${removed.length} unused file(s)`
    const commit = await api.createCommit(msg, tree, [head.commitSha])
    if (await api.updateHead(commit, false)) return { removed, kept }
  }
  throw new Error('cleanup conflicts persisted after retries')
}
