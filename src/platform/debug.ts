/**
 * QA switches kept in localStorage (`webnota:debug`, comma-separated), so error paths
 * can be exercised on real devices and in e2e without special builds.
 * Currently: `crash-editor`, `crash-sidebar` (throw while rendering that region).
 */
export function debugFlag(name: string): boolean {
  try {
    return (localStorage.getItem('webnota:debug') ?? '').split(',').includes(name)
  } catch {
    return false
  }
}

/** Throws during render when the matching debug flag is set. */
export function debugCrash(region: string) {
  if (debugFlag(`crash-${region}`)) throw new Error(`debug crash: ${region}`)
}
