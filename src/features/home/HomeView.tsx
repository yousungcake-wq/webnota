import { Plus } from 'lucide-react'
import { usePages } from '@/core/store/pages'
import { addPage } from '@/features/page'
import { PageTree } from '@/features/sidebar'
import { SyncBadge } from '@/features/sync'
import { ViewHeader } from '@/ui/ViewHeader'

/** Mobile home screen: the page tree, full width. */
export function HomeView() {
  const pages = usePages()
  return (
    <div className="view">
      <ViewHeader title="WebNota" right={<SyncBadge />} />
      <section className="section">
        <div className="section-head">
          <span>페이지</span>
          <button type="button" className="icon-btn sm" aria-label="새 페이지" onClick={() => addPage(null)}>
            <Plus size={16} />
          </button>
        </div>
        <PageTree pages={pages} />
      </section>
      <button type="button" className="fab" aria-label="새 페이지" onClick={() => addPage(null)}>
        <Plus size={26} />
      </button>
    </div>
  )
}
