/**
 * Leader election between tabs of the same browser (SY-02e): only the tab holding the
 * Web Lock syncs with GitHub; when it closes, the browser grants the lock to the next tab.
 * Without the Web Locks API (old browsers) every tab acts as leader, as before.
 */
interface Locks {
  request(name: string, cb: () => Promise<unknown>): Promise<unknown>
}

export function electLeader(name: string, onLeader: () => void, locks: Locks | null = navigator.locks ?? null) {
  let leader = false
  let resign: () => void = () => {}
  if (!locks) {
    leader = true
    queueMicrotask(onLeader)
  } else {
    void locks.request(
      name,
      () =>
        new Promise<void>((release) => {
          leader = true
          resign = release
          onLeader()
        }),
    )
  }
  return {
    isLeader: () => leader,
    /** Gives up leadership (tests; a closing tab releases the lock automatically). */
    resign: () => {
      leader = false
      resign()
    },
  }
}
