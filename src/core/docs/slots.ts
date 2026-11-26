/**
 * Local workspace slots (spec/03 WS-01, spec/06 SY-05). Each workspace on this device
 * has a device-local ID that namespaces its IndexedDB databases (`wn:<wsId>:<docName>`)
 * and its localStorage keys (`wsKey`). It is deliberately NOT stored in the Y.Doc: two
 * devices would create different IDs offline and LWW would pick one, while a local
 * namespace only has to be unique here (DECISIONS 016).
 *
 * The first slot of a device (the PoC-era data) keeps the original global key names
 * (`legacy`), so no key migration was needed; later slots prefix theirs.
 */
const KEY = 'webnota:workspaces'

export interface Slot {
  id: string
  name: string
  /** Emoji, optional. */
  icon?: string
  createdAt: number
  /** Uses the un-prefixed localStorage keys (the device's first workspace). */
  legacy?: boolean
}

interface Slots {
  current: string
  list: Slot[]
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 10)
}

let cache: Slots | null = null

function load(): Slots {
  if (cache) return cache
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null') as Slots | null
    if (saved?.current && Array.isArray(saved.list)) {
      // Slots written before multi-workspace support: the first one is the legacy slot.
      saved.list = saved.list.map((s, i) => ({ ...s, name: s.name ?? '', legacy: s.legacy ?? i === 0 }))
      return (cache = saved)
    }
    const id = randomId()
    cache = { current: id, list: [{ id, name: '', createdAt: Date.now(), legacy: true }] }
    localStorage.setItem(KEY, JSON.stringify(cache))
    return cache
  } catch {
    return (cache = { current: 'main', list: [{ id: 'main', name: '', createdAt: 0, legacy: true }] })
  }
}

function save(s: Slots) {
  cache = s
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}

/** The current slot ID. Without storage it falls back to `main`. */
export const currentWorkspaceId = (): string => load().current

export const listSlots = (): Slot[] => load().list
export const currentSlot = (): Slot => load().list.find((s) => s.id === load().current) ?? load().list[0]!

/** IndexedDB database name of a doc in a workspace (default: the current one). */
export const idbName = (docName: string, wsId = currentWorkspaceId()) => `wn:${wsId}:${docName}`

/** localStorage key for per-workspace state (dirty set, account, recent, …). */
export function wsKey(name: string, slot: Slot = currentSlot()): string {
  return slot.legacy ? `webnota:${name}` : `webnota:${slot.id}:${name}`
}

export function addSlot(name: string, icon?: string): string {
  const s = load()
  const id = randomId()
  save({ ...s, list: [...s.list, { id, name, icon, createdAt: Date.now(), legacy: false }] })
  return id
}

export function updateSlot(id: string, patch: Partial<Pick<Slot, 'name' | 'icon'>>) {
  const s = load()
  save({ ...s, list: s.list.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
}

/**
 * Makes `id` current and reloads, which unloads every open doc (WS-01). The app opens at
 * home unless `keepUrl` (a link that names this workspace, #/w/<id>/…).
 */
export function switchSlot(id: string, keepUrl = false) {
  const s = load()
  if (!s.list.some((x) => x.id === id) || s.current === id) return
  save({ ...s, current: id })
  // The current URL may name the old workspace (#/w/<old>/…), which would switch back.
  if (!keepUrl) history.replaceState(null, '', location.pathname + location.search)
  location.reload()
}

/**
 * Forgets a workspace on this device: its local databases and keys are deleted. The
 * GitHub repository is untouched. The current workspace cannot be removed.
 */
export async function removeSlot(id: string) {
  const s = load()
  const slot = s.list.find((x) => x.id === id)
  if (!slot || s.current === id) return
  save({ ...s, list: s.list.filter((x) => x.id !== id) })
  try {
    const dbs = (await indexedDB.databases?.()) ?? []
    await Promise.all(
      dbs
        .filter((d) => d.name?.startsWith(`wn:${id}:`))
        .map(
          (d) =>
            new Promise((r) => {
              const req = indexedDB.deleteDatabase(d.name!)
              req.onsuccess = req.onerror = req.onblocked = () => r(null)
            }),
        ),
    )
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k?.startsWith(`webnota:${id}:`)) localStorage.removeItem(k)
    }
  } catch {
    /* best effort */
  }
}
