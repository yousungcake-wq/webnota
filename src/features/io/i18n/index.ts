import { addMessages, getLang, tFeature } from '@/core/i18n'
import type { IoKey } from './ko'

/** Loads the import / export dictionary for the current language. */
export async function loadIoMessages() {
  addMessages(getLang() === 'ko' ? (await import('./ko')).ko : (await import('./en')).en)
}

export const it = (key: IoKey, params?: Record<string, string | number>) => tFeature(key, params)
