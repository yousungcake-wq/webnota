import { AlertCircle, Check, CloudOff, Loader2, RefreshCw } from 'lucide-react'
import { syncNow, useSync } from '../sync/controller'
import { href } from './hooks'

export function SyncBadge({ compact }: { compact?: boolean }) {
  const s = useSync()
  if (s.status === 'disconnected') {
    return (
      <a
        className="sync-badge is-off"
        href={href({ name: 'settings' })}
        title="GitHub를 연결하면 기기 간 동기화가 됩니다"
      >
        <CloudOff size={14} />
        {!compact && <span>이 기기에만 저장됨</span>}
      </a>
    )
  }
  const map = {
    idle: { icon: <Check size={14} />, label: '동기화됨', cls: 'is-ok' },
    pending: { icon: <RefreshCw size={14} />, label: '변경 사항 대기 중', cls: 'is-pending' },
    syncing: { icon: <Loader2 size={14} className="spin" />, label: '동기화 중', cls: 'is-pending' },
    offline: { icon: <CloudOff size={14} />, label: '오프라인', cls: 'is-off' },
    error: { icon: <AlertCircle size={14} />, label: '동기화 오류', cls: 'is-error' },
  } as const
  const m = map[s.status]
  return (
    <button
      type="button"
      className={`sync-badge ${m.cls}`}
      title={s.error ?? (s.lastSyncedAt ? `마지막 동기화: ${new Date(s.lastSyncedAt).toLocaleTimeString()}` : m.label)}
      onClick={() => void syncNow()}
    >
      {m.icon}
      {!compact && <span>{m.label}</span>}
    </button>
  )
}
