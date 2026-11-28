import type { ViewLayout } from '@/core/model/views'
import type { MessageKey } from '@/core/i18n'

/**
 * Layouts a new view can have (WS-11): a document or a database (Grid, Board, Calendar —
 * M5-11). While only one is available, "+" creates it directly instead of opening a menu.
 */
export const VIEW_LAYOUTS: { layout: ViewLayout; label: MessageKey; available: () => boolean }[] = [
  { layout: 'document', label: 'newView.document', available: () => true },
  { layout: 'grid', label: 'newView.grid', available: () => true },
  { layout: 'board', label: 'newView.board', available: () => true },
  { layout: 'calendar', label: 'newView.calendar', available: () => true },
]

export const availableLayouts = () => VIEW_LAYOUTS.filter((l) => l.available())
