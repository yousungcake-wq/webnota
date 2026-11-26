import { useSyncExternalStore } from 'react'
import { getSyncState, subscribeSync, type ControllerState } from '../sync/controller'

export function useSync(): ControllerState {
  return useSyncExternalStore(subscribeSync, getSyncState)
}
