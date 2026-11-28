import { parseSpaceDoc, SPACE_DOC, spaceDocName } from '../docs/spaceDocs'
import type { LocalStore, SyncState } from './engine'

/**
 * Sync targets (M9-01, spec/06 SY-08): the home repository plus one repository per shared
 * space. The engine runs once per target against a scoped view of the local store: in a
 * shared space's target the docs are `sp:<space>:<name>` locally and `<name>` in that
 * repository, and the space's own view tree (`sp:<space>:space`) plays the part the
 * workspace document plays at home (root path `data/space.yjs`).
 */
export interface SyncTarget {
  /** null: the home repository. */
  spaceId: string | null
  owner: string
  repo: string
  branch: string
}

export const SPACE_ROOT_PATH = 'data/space.yjs'

export const targetKey = (t: Pick<SyncTarget, 'owner' | 'repo' | 'branch'>) => `${t.owner}/${t.repo}@${t.branch}`

/** Which target a local doc belongs to: its space, or home (null). */
export const spaceOfDoc = (docName: string) => parseSpaceDoc(docName).spaceId

/**
 * A shared space's view of the store: names without the `sp:<space>:` prefix, only that
 * space's dirty docs, `workspace` = its `space` document, its own sync state.
 */
export function scopeStore(
  base: Pick<LocalStore, 'getDoc' | 'getDirty' | 'clearDirty'>,
  spaceId: string,
  state: { load: () => SyncState; save: (s: SyncState) => void },
  files?: Pick<LocalStore, 'pendingFiles' | 'filesUploaded'>,
): LocalStore {
  const local = (name: string) => spaceDocName(spaceId, name === 'workspace' ? SPACE_DOC : name)
  const prefix = spaceDocName(spaceId, '')
  return {
    getDoc: (name) => base.getDoc(local(name)),
    getDirty: () => {
      const out: Record<string, number> = {}
      for (const [name, gen] of Object.entries(base.getDirty())) {
        if (!name.startsWith(prefix)) continue
        const inner = name.slice(prefix.length)
        out[inner === SPACE_DOC ? 'workspace' : inner] = gen
      }
      return out
    },
    clearDirty: (name, gen) => base.clearDirty(local(name), gen),
    loadState: state.load,
    saveState: state.save,
    ...(files ?? {}),
  }
}
