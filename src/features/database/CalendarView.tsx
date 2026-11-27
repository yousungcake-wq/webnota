import { EmptyState } from '@/ui'
import { dt } from './i18n'
import type { LayoutProps } from './layoutProps'

/** Calendar layout (M5). Lazy chunk inside the database feature. */
export default function CalendarView(_props: LayoutProps) {
  return <EmptyState title={dt('db.comingSoon')} description={dt('db.comingSoonHint')} />
}
