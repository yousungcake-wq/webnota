import { LogOut, Monitor, Moon, RefreshCw, Sun, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { oauthAvailable, startLogin } from '@/core/auth/auth'
import { setTheme, useTheme } from '@/core/store/prefs'
import { useSync } from '@/core/store/sync'
import { connect, disconnect, syncNow } from '@/core/sync/controller'
import { SyncBadge } from '@/features/sync'
import { ViewHeader } from '@/ui/ViewHeader'
import './settings.css'

function Github({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

export function SettingsView() {
  const theme = useTheme()
  const sync = useSync()
  const [pat, setPat] = useState('')
  const [repo, setRepo] = useState('webnota-data')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const doConnect = async () => {
    setBusy(true)
    setErr(null)
    try {
      await connect(pat.trim(), repo.trim() || 'webnota-data')
      setPat('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="view">
      <ViewHeader title="설정" />

      <section className="card">
        <h2>
          <Github size={18} /> GitHub 동기화
        </h2>
        {sync.account ? (
          <>
            <div className="account">
              <img src={sync.account.avatarUrl} alt="" width={40} height={40} />
              <div>
                <div className="account-name">{sync.account.login}</div>
                <div className="muted small">
                  비공개 저장소 <code>{`${sync.account.owner}/${sync.account.repo}`}</code>
                </div>
              </div>
            </div>
            <div className="row-gap">
              <SyncBadge />
              {sync.lastSyncedAt && (
                <span className="muted small">마지막 동기화 {new Date(sync.lastSyncedAt).toLocaleTimeString()}</span>
              )}
            </div>
            {sync.error && <p className="error">{sync.error}</p>}
            <div className="row-gap">
              <button type="button" className="btn" onClick={() => void syncNow()}>
                <RefreshCw size={16} /> 지금 동기화
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  if (confirm('GitHub 연결을 해제할까요? 이 기기의 노트는 그대로 남습니다.')) disconnect()
                }}
              >
                <LogOut size={16} /> 연결 해제
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              GitHub에 로그인하면 내 계정의 비공개 저장소에 노트가 저장되고, 다른 기기와 자동으로 동기화됩니다. 서버에는
              아무것도 저장되지 않습니다.
            </p>
            {sync.error && <p className="error">{sync.error}</p>}
            {oauthAvailable && (
              <button type="button" className="btn primary full" onClick={() => startLogin()}>
                <Github size={18} /> GitHub로 로그인
              </button>
            )}
            <details className="pat" open={!oauthAvailable}>
              <summary>{oauthAvailable ? '개인 액세스 토큰으로 연결 (고급)' : '개인 액세스 토큰으로 연결'}</summary>
              <ol className="small muted">
                <li>
                  GitHub에서 비공개 저장소 <code>{repo || 'webnota-data'}</code>를 만듭니다. README 포함을 권장합니다.
                </li>
                <li>
                  Settings → Developer settings → Fine-grained tokens에서 이 저장소만 선택하고,{' '}
                  <b>Contents: Read and write</b> 권한으로 토큰을 만듭니다.
                </li>
                <li>아래에 붙여넣고 연결합니다. 토큰은 이 기기에만 저장됩니다.</li>
              </ol>
              <label className="field">
                <span>저장소 이름</span>
                <input
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </label>
              <label className="field">
                <span>토큰</span>
                <input
                  type="password"
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                  placeholder="github_pat_…"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              {err && <p className="error">{err}</p>}
              <button type="button" className="btn primary" disabled={!pat.trim() || busy} onClick={doConnect}>
                {busy ? '연결 중…' : '연결'}
              </button>
            </details>
          </>
        )}
      </section>

      <section className="card">
        <h2>테마</h2>
        <div className="segmented" role="radiogroup" aria-label="테마">
          {(
            [
              ['system', '시스템', Monitor],
              ['light', '라이트', Sun],
              ['dark', '다크', Moon],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={theme === v}
              className={theme === v ? 'is-on' : ''}
              onClick={() => setTheme(v)}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>정보</h2>
        <p className="muted small">
          WebNota {__APP_VERSION__}. 노트는 이 기기(IndexedDB)에 먼저 저장되고, GitHub를 연결하면 자동으로 동기화됩니다.
          홈 화면에 추가하면 오프라인에서도 앱처럼 쓸 수 있습니다.
        </p>
        <a className="btn ghost" href="#/trash">
          <Trash2 size={16} /> 휴지통
        </a>
      </section>
    </div>
  )
}
