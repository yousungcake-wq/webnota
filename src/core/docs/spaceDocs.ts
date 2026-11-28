/**
 * Document names of shared spaces (M9, spec/06 SY-08). A shared space's documents keep
 * their usual names inside its repository (`page/<id>`, `db/<id>`, …) but are prefixed
 * locally — `sp:<spaceId>:<name>` — so they get their own IndexedDB databases
 * (`wn:<ws>:sp:<spaceId>:<name>`) and the sync engine can route them to that repository.
 * The space's own view tree is the document `space` there.
 */
export const SPACE_DOC = 'space'
const PREFIX = 'sp:'

export const spaceDocName = (spaceId: string, name: string) => `${PREFIX}${spaceId}:${name}`

/** `sp:<space>:<name>` → the space and the name inside its repository; others → home. */
export function parseSpaceDoc(docName: string): { spaceId: string | null; name: string } {
  if (!docName.startsWith(PREFIX)) return { spaceId: null, name: docName }
  const rest = docName.slice(PREFIX.length)
  const i = rest.indexOf(':')
  if (i <= 0) return { spaceId: null, name: docName }
  return { spaceId: rest.slice(0, i), name: rest.slice(i + 1) }
}
