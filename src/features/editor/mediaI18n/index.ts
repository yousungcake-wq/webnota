import { addMessages, getLang, tFeature } from '@/core/i18n'
import type { MediaKey } from './ko'

/** Loads the media toolbar dictionary for the current language. */
export async function loadMediaMessages() {
  addMessages(getLang() === 'ko' ? (await import('./ko')).ko : (await import('./en')).en)
}

export const mt = (key: MediaKey) => tFeature(key)
