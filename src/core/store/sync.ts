import { syncStore, type ControllerState } from '../sync/controller'
import { useStore } from './useStore'

export function useSync(): ControllerState {
  return useStore(syncStore)
}
