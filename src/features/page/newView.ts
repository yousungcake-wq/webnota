import { isEnabled } from '@/core/flags'
import type { ViewLayout } from '@/core/model/views'
import type { MessageKey } from '@/core/i18n'

/**
 * Layouts a new view can have (WS-11). Grid is available behind the `database` flag
 * (M4); Board and Calendar arrive with M5. While only one is available, "+" creates it
 * directly instead of opening a menu.
 */
export const VIEW_LAYOUTS: { layout: ViewLayout; label: MessageKey; available: () => boolean }[] = [
  { layout: 'document', label: 'newView.document', available: () => true },
  { layout: 'grid', label: 'newView.grid', available: () => isEnabled('database') },
  { layout: 'board', label: 'newView.board', available: () => false },
  { layout: 'calendar', label: 'newView.calendar', available: () => false },
]

export const availableLayouts = () => VIEW_LAYOUTS.filter((l) => l.available())
