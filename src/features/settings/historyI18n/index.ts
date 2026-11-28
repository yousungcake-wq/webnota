import { addMessages, getLang, tFeature } from '@/core/i18n'
import type { HistoryKey } from './ko'

/** Loads the repository history dictionary for the current language (M6-09). */
export async function loadHistoryMessages() {
  addMessages(getLang() === 'ko' ? (await import('./ko')).ko : (await import('./en')).en)
}

export const ht = (key: HistoryKey, params?: Record<string, string | number>) => tFeature(key, params)
