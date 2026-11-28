import { addMessages, getLang, tFeature, tFeatureParts } from '@/core/i18n'
import type { HistoryKey } from './ko'

/** Loads the settings dictionary for the current language (M6-09, M7-00). */
export async function loadSettingsMessages() {
  addMessages(getLang() === 'ko' ? (await import('./ko')).ko : (await import('./en')).en)
}

export const st = (key: HistoryKey, params?: Record<string, string | number>) => tFeature(key, params)

/** `st` with element parameters (links, code) — the message split around them. */
export const stParts = <T>(key: HistoryKey, params: Record<string, T>) => tFeatureParts(key, params)
