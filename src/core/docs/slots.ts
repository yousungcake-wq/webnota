/**
 * Local workspace slots (spec/03 WS-01, spec/06 SY-05). Each workspace on this device has
 * a device-local ID that namespaces its IndexedDB databases: `wn:<wsId>:<docName>`.
 * It is deliberately NOT stored in the Y.Doc: two devices would create different IDs
 * offline and LWW would pick one, while a local namespace only has to be unique here.
 * Multiple slots (switching, per-repo) arrive with SY-05 (M1); for now there is one.
 */
const KEY = 'webnota:workspaces'

interface Slots {
  current: string
  list: { id: string; createdAt: number }[]
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 10)
}

let cached: string | null = null

/** The current slot ID, created on first use. Without storage it falls back to `main`. */
export function currentWorkspaceId(): string {
  if (cached) return cached
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null') as Slots | null
    if (saved?.current) return (cached = saved.current)
    const id = randomId()
    const slots: Slots = { current: id, list: [{ id, createdAt: Date.now() }] }
    localStorage.setItem(KEY, JSON.stringify(slots))
    return (cached = id)
  } catch {
    return (cached = 'main')
  }
}

/** IndexedDB database name of a doc in the current workspace. */
export const idbName = (docName: string, wsId = currentWorkspaceId()) => `wn:${wsId}:${docName}`
