import { RotateCcw, Trash2 } from 'lucide-react'
import { displayTitle } from '@/features/page'
import { useViews } from '@/core/store/views'
import { deleteForever, deleteManyForever, restore, restoreAll, ViewIcon } from '@/features/page'
import { Button, confirmDialog, IconButton, ViewHeader } from '@/ui'
import { t, getLang } from '@/core/i18n'

export function TrashView() {
  const pages = useViews()
  const trashed = pages.filter((p) => p.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  return (
    <div className="view">
      <ViewHeader
        title={t('common.trash')}
        right={
          trashed.length > 0 && (
            <div className="row-gap">
              <Button size="sm" variant="ghost" onClick={restoreAll}>
                {t('trash.restoreAll')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() =>
                  void confirmDialog({
                    title: t('trash.emptyAll'),
                    message: t('trash.emptyAllConfirm', { count: trashed.length }),
                    confirmLabel: t('trash.emptyAll'),
                    danger: true,
                  }).then((ok) => ok && void deleteManyForever(trashed.map((p) => p.id)))
                }
              >
                {t('trash.emptyAll')}
              </Button>
            </div>
          )
        }
      />
      <div className="list">
        {trashed.map((p) => (
          <div key={p.id} className="list-item static">
            <span className="tree-icon">
              <ViewIcon icon={p.icon} />
            </span>
            <span className="list-text">
              <span className="list-title">{displayTitle(p.title)}</span>
              <span className="list-sub">
                {t('trash.deletedAt', { date: new Date(p.deletedAt!).toLocaleString(getLang()) })}
              </span>
            </span>
            <IconButton icon={RotateCcw} label={t('trash.restore')} onClick={() => restore(p.id)} />
            <IconButton
              icon={Trash2}
              tone="danger"
              label={t('trash.deleteForever')}
              onClick={() => {
                void confirmDialog({
                  title: t('trash.deleteTitle'),
                  message: t('trash.confirmDelete', { title: displayTitle(p.title) }),
                  confirmLabel: t('trash.deleteForever'),
                  danger: true,
                }).then((ok) => {
                  if (ok) void deleteForever(p.id)
                })
              }}
            />
          </div>
        ))}
        {!trashed.length && <p className="muted pad">{t('trash.empty')}</p>}
      </div>
    </div>
  )
}
