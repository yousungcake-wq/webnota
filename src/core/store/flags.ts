import { useCallback } from 'react'
import { flagStore, type FlagName } from '../flags'
import { useStore } from './useStore'

export function useFlag(name: FlagName): boolean {
  return useStore(
    flagStore,
    useCallback((v) => v[name], [name]),
  )
}
