import { getLang } from '@/core/i18n'
import type { Template } from './types'

export type { DocTemplate, Template } from './types'

let set: Promise<Template[]> | null = null
let setLang = ''
/** The built-in templates in the current language (M8-09), a small lazy chunk. */
export function loadTemplates(): Promise<Template[]> {
  if (!set || setLang !== getLang()) {
    setLang = getLang()
    set = (setLang === 'ko' ? import('./contentKo') : import('./contentEn')).then((m) => m.templates)
  }
  return set
}

export const loadTemplateActions = () => import('./create')
