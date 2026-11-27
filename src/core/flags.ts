import type { MessageKey } from './i18n'
import { createStore } from './store/createStore'

/**
 * Feature flags and developer options (spec/11 §6, ST-12), per device.
 *
 * - `feature`: an unfinished feature merged to main behind a flag. Remove the flag
 *   (and this entry) when the feature ships — the checklist item says so.
 * - `dev`: developer options that stay (debug logging, …).
 */
interface FlagDef {
  kind: 'feature' | 'dev'
  default: boolean
  label: MessageKey
  description?: MessageKey
}

export const FLAGS = {
  debugLog: { kind: 'dev', default: false, label: 'flag.debugLog', description: 'flag.debugLog.desc' },
  // M4–M5 (spec/05): Grid view while the database is unfinished. Remove when M5 ships.
  database: { kind: 'feature', default: false, label: 'flag.database', description: 'flag.database.desc' },
} satisfies Record<string, FlagDef>

export type FlagName = keyof typeof FLAGS
type FlagValues = Record<FlagName, boolean>

const KEY = 'webnota:flags'

function load(): FlagValues {
  const values = Object.fromEntries(Object.entries(FLAGS).map(([k, d]) => [k, d.default])) as FlagValues
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, unknown>
    for (const k of Object.keys(values) as FlagName[]) if (typeof saved[k] === 'boolean') values[k] = saved[k]
  } catch {
    /* no storage (tests, private mode): defaults */
  }
  return values
}

/** Read in React with `useFlag` (core/store/flags.ts). */
export const flagStore = createStore<FlagValues>(load())

export const isEnabled = (name: FlagName): boolean => flagStore.get()[name]

export function setFlag(name: FlagName, value: boolean) {
  flagStore.set((v) => ({ ...v, [name]: value }))
  try {
    localStorage.setItem(KEY, JSON.stringify(flagStore.get()))
  } catch {
    /* ignore */
  }
}

/** Console logging behind the `debugLog` developer option. */
export function debugLog(scope: string, ...args: unknown[]) {
  // eslint-disable-next-line no-console
  if (isEnabled('debugLog')) console.debug(`[webnota:${scope}]`, ...args)
}
