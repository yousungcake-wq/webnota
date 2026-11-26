import type { MessageKey } from './ko'

export type { MessageKey }
export type Lang = 'ko' | 'en'
export const LANGS: readonly Lang[] = ['ko', 'en']
/** Each language's own name, shown in the picker regardless of the UI language. */
export const LANG_NAMES: Record<Lang, string> = { ko: '한국어', en: 'English' }

const KEY = 'webnota:lang'

/** Korean if any preferred browser language is Korean, otherwise English. */
export function detectLang(languages: readonly string[]): Lang {
  return languages.some((l) => l.toLowerCase().startsWith('ko')) ? 'ko' : 'en'
}

/** The saved choice, or 'system' to follow the browser. */
export function getLangPref(): Lang | 'system' {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'ko' || v === 'en' ? v : 'system'
  } catch {
    return 'system'
  }
}

function resolve(): Lang {
  const pref = getLangPref()
  if (pref !== 'system') return pref
  return detectLang(typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]))
}

// The language is fixed for the page's lifetime; changing it reloads (see setLangPref).
let lang: Lang = resolve()
let dict: Record<MessageKey, string> | null = null

/**
 * Loads the dictionary for `l` (default: saved choice or browser language). Only the
 * active language is downloaded; boot awaits this before the first render.
 */
export async function initI18n(l: Lang = resolve()): Promise<void> {
  const loaded = l === 'ko' ? (await import('./ko')).ko : (await import('./en')).en
  lang = l
  dict = loaded
}

export const getLang = (): Lang => lang

/** Saves the choice. The caller reloads the page so every string (including module-level ones) updates. */
export function setLangPref(pref: Lang | 'system') {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    /* ignore */
  }
}

const PARAM = /\{(\w+)\}/g

/** Translate `key`, replacing `{name}` with `params.name`. Falls back to the key before `initI18n`. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const msg = dict?.[key] ?? key
  return params ? msg.replace(PARAM, (m, name: string) => (name in params ? String(params[name]) : m)) : msg
}

/**
 * Like `t`, but parameters may be any value (e.g. React elements): returns the
 * message split into an array of strings and those values, in order.
 */
export function tParts<T>(key: MessageKey, params: Record<string, T>): (string | T)[] {
  const msg = dict?.[key] ?? key
  const out: (string | T)[] = []
  let last = 0
  for (const m of msg.matchAll(PARAM)) {
    const name = m[1]!
    if (!(name in params)) continue
    if (m.index > last) out.push(msg.slice(last, m.index))
    out.push(params[name]!)
    last = m.index + m[0].length
  }
  if (last < msg.length) out.push(msg.slice(last))
  return out
}
