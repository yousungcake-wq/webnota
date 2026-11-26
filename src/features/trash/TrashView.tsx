import { RotateCcw, Trash2 } from 'lucide-react'
import { displayTitle } from '@/features/page'
import { usePages } from '@/core/store/pages'
import { deleteForever, restore } from '@/features/page'
import { ViewHeader } from '@/ui/ViewHeader'
import { t, getLang } from '@/core/i18n'

export function TrashView() {
  const pages = usePages()
  const trashed = pages.filter((p) => p.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  return (
    <div className="view">
      <ViewHeader title={t('common.trash')} />
      <div className="list">
        {trashed.map((p) => (
          <div key={p.id} className="list-item static">
            <span className="tree-icon">{p.icon || '📄'}</span>
            <span className="list-text">
              <span className="list-title">{displayTitle(p.title)}</span>
              <span className="list-sub">
                {t('trash.deletedAt', { date: new Date(p.deletedAt!).toLocaleString(getLang()) })}
              </span>
            </span>
            <button
              type="button"
              className="icon-btn"
              aria-label={t('trash.restore')}
              title={t('trash.restore')}
              onClick={() => restore(p.id)}
            >
              <RotateCcw size={18} />
            </button>
            <button
              type="button"
              className="icon-btn danger"
              aria-label={t('trash.deleteForever')}
              title={t('trash.deleteForever')}
              onClick={() => {
                if (confirm(t('trash.confirmDelete', { title: displayTitle(p.title) }))) void deleteForever(p.id)
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        {!trashed.length && <p className="muted pad">{t('trash.empty')}</p>}
      </div>
    </div>
  )
}
