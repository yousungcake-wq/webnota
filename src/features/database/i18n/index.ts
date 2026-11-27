import { addMessages, getLang, tFeature } from '@/core/i18n'
import type { DbKey } from './ko'

export type { DbKey }

/** Loads the database dictionary for the current language (before the view renders). */
export async function loadDbMessages() {
  addMessages(getLang() === 'ko' ? (await import('./ko')).ko : (await import('./en')).en)
}

/** `t()` for database strings. */
export const dt = (key: DbKey, params?: Record<string, string | number>) => tFeature(key, params)
