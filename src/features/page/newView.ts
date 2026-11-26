import type { ViewLayout } from '@/core/model/views'
import type { MessageKey } from '@/core/i18n'

/**
 * Layouts a new view can have (WS-11). Database layouts turn `available` on with M4–M5;
 * while only one is available, "+" creates it directly instead of opening a menu.
 */
export const VIEW_LAYOUTS: { layout: ViewLayout; label: MessageKey; available: boolean }[] = [
  { layout: 'document', label: 'newView.document', available: true },
  { layout: 'grid', label: 'newView.grid', available: false },
  { layout: 'board', label: 'newView.board', available: false },
  { layout: 'calendar', label: 'newView.calendar', available: false },
]

export const availableLayouts = () => VIEW_LAYOUTS.filter((l) => l.available)
