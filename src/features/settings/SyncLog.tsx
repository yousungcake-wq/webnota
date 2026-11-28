import { getLang } from '@/core/i18n'
import { useStore } from '@/core/store/useStore'
import { syncLogStore, type SyncLogEntry } from '@/core/sync/log'
import { st } from './i18n'

/** Recent sync runs (SY-02d, ST-04). */
export function SyncLog() {
  const log = useStore(syncLogStore)
  return (
    <details className="sync-log">
      <summary>{st('settings.syncLog', { count: log.length })}</summary>
      {log.length === 0 ? (
        <p className="muted small">{st('settings.syncLog.empty')}</p>
      ) : (
        <ol>
          {log.map((e) => (
            <li key={`${e.at}-${e.firstAt ?? ''}`} className={e.ok ? undefined : 'is-error'}>
              <time dateTime={new Date(e.at).toISOString()}>{formatTime(e)}</time>
              <span>{describe(e)}</span>
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}

function formatTime(e: SyncLogEntry) {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleString(getLang(), { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  return e.firstAt ? `${fmt(e.firstAt)} – ${fmt(e.at)}` : fmt(e.at)
}

function describe(e: SyncLogEntry) {
  const main = !e.ok
    ? st('settings.syncLog.failed', { error: e.error ?? '?' })
    : e.pulled + e.pushed + e.deleted === 0
      ? st('settings.syncLog.noop')
      : st('settings.syncLog.changes', { pulled: e.pulled, pushed: e.pushed, deleted: e.deleted })
  return e.repeat ? `${main} ${st('settings.syncLog.repeat', { count: e.repeat })}` : main
}
