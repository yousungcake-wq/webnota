import { Plus } from 'lucide-react'
import { useCurrentSpace } from '@/core/store/views'
import { addPage } from '@/features/page'
import { PageTree } from '@/features/sidebar'
import { SyncBadge } from '@/features/sync'
import { IconButton, ViewHeader } from '@/ui'
import { t } from '@/core/i18n'

/** Mobile home screen: the page tree, full width. */
export function HomeView() {
  const spaceId = useCurrentSpace()
  return (
    <div className="view">
      <ViewHeader title="WebNota" right={<SyncBadge />} />
      <section className="section">
        <div className="section-head">
          <span>{t('common.pages')}</span>
          <IconButton size="sm" icon={Plus} label={t('common.newPage')} onClick={() => addPage(null)} />
        </div>
        <PageTree spaceId={spaceId} />
      </section>
      <button type="button" className="fab" aria-label={t('common.newPage')} onClick={() => addPage(null)}>
        <Plus size={26} />
      </button>
    </div>
  )
}
