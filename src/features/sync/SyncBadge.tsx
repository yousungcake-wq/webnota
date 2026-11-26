import { AlertCircle, Check, CloudOff, Loader2, RefreshCw } from 'lucide-react'
import { href } from '@/core/store/router'
import { useSync } from '@/core/store/sync'
import { syncNow } from '@/core/sync/controller'
import './sync.css'
import { t, getLang } from '@/core/i18n'

export function SyncBadge({ compact }: { compact?: boolean }) {
  const s = useSync()
  if (s.status === 'disconnected') {
    return (
      <a className="sync-badge is-off" href={href({ name: 'settings' })} title={t('sync.localOnlyHint')}>
        <CloudOff size={14} />
        {!compact && <span>{t('sync.localOnly')}</span>}
      </a>
    )
  }
  const map = {
    idle: { icon: <Check size={14} />, label: t('sync.idle'), cls: 'is-ok' },
    pending: { icon: <RefreshCw size={14} />, label: t('sync.pending'), cls: 'is-pending' },
    syncing: { icon: <Loader2 size={14} className="spin" />, label: t('sync.syncing'), cls: 'is-pending' },
    offline: { icon: <CloudOff size={14} />, label: t('sync.offline'), cls: 'is-off' },
    error: { icon: <AlertCircle size={14} />, label: t('sync.error'), cls: 'is-error' },
  } as const
  const m = map[s.status]
  return (
    <button
      type="button"
      className={`sync-badge ${m.cls}`}
      title={
        s.error ??
        (s.lastSyncedAt
          ? t('sync.lastSynced', { time: new Date(s.lastSyncedAt).toLocaleTimeString(getLang()) })
          : m.label)
      }
      onClick={() => void syncNow()}
    >
      {m.icon}
      {!compact && <span>{m.label}</span>}
    </button>
  )
}
