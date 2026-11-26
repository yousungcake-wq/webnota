import { t } from '@/core/i18n'
import type { PageMeta } from '@/core/model/pages'

export function displayTitle(title: string) {
  return title.trim() || t('common.untitled')
}

/** "Parent / Child" breadcrumb text for list subtitles (up to 10 levels). */
export function pathOf(p: PageMeta, byId: Map<string, PageMeta>): string {
  const parts: string[] = []
  let cur = p.parentId ? byId.get(p.parentId) : undefined
  while (cur && parts.length < 10) {
    parts.unshift(displayTitle(cur.title))
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return parts.join(' / ')
}
