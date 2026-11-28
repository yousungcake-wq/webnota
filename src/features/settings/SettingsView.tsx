import { LogOut, Monitor, Moon, RefreshCw, Sun, Trash2 } from 'lucide-react'
import { Fragment, lazy, Suspense, use, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { oauthAvailable, startLogin } from '@/core/auth/auth'
import { FLAGS, setFlag, type FlagName } from '@/core/flags'
import { useFlag } from '@/core/store/flags'
import { getLang, getLangPref, LANG_NAMES, LANGS, setLangPref, t, tParts, type MessageKey } from '@/core/i18n'
import {
  setImageOriginal,
  setTheme,
  setTrashAutoEmpty,
  trashAutoEmptyStore,
  useImageOriginal,
  useTheme,
} from '@/core/store/prefs'
import { useStore } from '@/core/store/useStore'
import { useSync } from '@/core/store/sync'
import { connect, disconnect, syncNow } from '@/core/sync/controller'
import { SyncBadge } from '@/features/sync'
import { Button, confirmDialog, Input, LinkButton, Segmented, Switch, toast, ViewHeader } from '@/ui'
import { loadWorkspaceSettings } from '@/features/workspaces'
import { loadIoSection } from '@/features/io'
import './settings.css'

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')
const subscribeScheme = (cb: () => void) => {
  const q = darkQuery()
  q.addEventListener('change', cb)
  return () => q.removeEventListener('change', cb)
}
/** The OS light/dark setting, live (shown next to the "system" theme choice). */
const useSystemTheme = () => useSyncExternalStore(subscribeScheme, () => (darkQuery().matches ? 'dark' : 'light'))

const WorkspaceSettings = lazy(loadWorkspaceSettings)
const IoSection = lazy(loadIoSection)
import { SyncLog } from './SyncLog'
import { ht, loadHistoryMessages } from './historyI18n'

function Github({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

/** Renders a message whose parameters are elements. */
function parts(key: MessageKey, params: Record<string, ReactNode>) {
  return tParts(key, params).map((p, i) => <Fragment key={i}>{p}</Fragment>)
}

export function SettingsView() {
  const langPref = getLangPref()
  const theme = useTheme()
  const systemTheme = useSystemTheme()
  const sync = useSync()
  const trashAuto = useStore(trashAutoEmptyStore)
  const imageOriginal = useImageOriginal()
  const [pat, setPat] = useState('')
  const [repo, setRepo] = useState('webnota-data')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const doConnect = async () => {
    setBusy(true)
    setErr(null)
    try {
      await connect(pat.trim(), repo.trim() || undefined)
      setPat('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="view">
      <ViewHeader title={t('common.settings')} />
      <Suspense fallback={null}>
        <WorkspaceSettings />
      </Suspense>

      <section className="card">
        <h2>
          <Github size={18} /> {t('settings.github')}
        </h2>
        {sync.account ? (
          <>
            <div className="account">
              <img src={sync.account.avatarUrl} alt="" width={40} height={40} />
              <div>
                <div className="account-name">{sync.account.login}</div>
                <div className="muted small">
                  {parts('settings.privateRepo', { repo: <code>{`${sync.account.owner}/${sync.account.repo}`}</code> })}
                </div>
              </div>
            </div>
            <div className="row-gap">
              <SyncBadge />
              {sync.lastSyncedAt && (
                <span className="muted small">
                  {t('settings.lastSynced', { time: new Date(sync.lastSyncedAt).toLocaleTimeString(getLang()) })}
                </span>
              )}
            </div>
            {sync.error && <p className="error">{sync.error}</p>}
            <div className="row-gap">
              <Button icon={RefreshCw} onClick={() => void syncNow()}>
                {t('settings.syncNow')}
              </Button>
              <Button
                variant="ghost"
                icon={LogOut}
                onClick={() => {
                  void confirmDialog({
                    title: t('settings.disconnectTitle'),
                    message: t('settings.confirmDisconnect'),
                    confirmLabel: t('settings.disconnect'),
                  }).then((ok) => {
                    if (ok) disconnect()
                  })
                }}
              >
                {t('settings.disconnect')}
              </Button>
            </div>
            <SyncLog />
          </>
        ) : (
          <>
            <p className="muted">{t('settings.githubIntro')}</p>
            {sync.error && <p className="error">{sync.error}</p>}
            {oauthAvailable && (
              <Button variant="primary" full onClick={() => startLogin()}>
                <Github size={18} /> {t('settings.login')}
              </Button>
            )}
            <details className="pat" open={!oauthAvailable}>
              <summary>{oauthAvailable ? t('settings.patAdvanced') : t('settings.pat')}</summary>
              <ol className="small muted">
                <li>{parts('settings.patStep1', { repo: <code>{repo || 'webnota-data'}</code> })}</li>
                <li>{parts('settings.patStep2', { permission: <b>Contents: Read and write</b> })}</li>
                <li>{t('settings.patStep3')}</li>
              </ol>
              <Input
                label={t('settings.repoName')}
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                autoCapitalize="none"
                spellCheck={false}
              />
              <Input
                label={t('settings.token')}
                type="password"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="github_pat_…"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
              />
              {err && <p className="error">{err}</p>}
              <Button variant="primary" disabled={!pat.trim() || busy} onClick={doConnect}>
                {busy ? t('settings.connecting') : t('settings.connect')}
              </Button>
            </details>
          </>
        )}
      </section>

      <section className="card">
        <h2>{t('settings.theme')}</h2>
        <Segmented
          label={t('settings.theme')}
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'system', label: t('settings.theme.system'), icon: Monitor },
            { value: 'light', label: t('settings.theme.light'), icon: Sun },
            { value: 'dark', label: t('settings.theme.dark'), icon: Moon },
          ]}
        />
        <p className="settings-now" aria-live="polite">
          {t('settings.now', {
            value: t(
              (theme === 'system' ? systemTheme : theme) === 'dark' ? 'settings.theme.dark' : 'settings.theme.light',
            ),
          })}
          {theme === 'system' && ` · ${t('settings.theme.followsSystem')}`}
        </p>
      </section>

      <section className="card">
        <h2>{t('settings.language')}</h2>
        <Segmented
          label={t('settings.language')}
          value={langPref}
          onChange={(v) => {
            if (v === langPref) return
            setLangPref(v)
            location.reload() // every string, including module-level ones, is resolved at load
          }}
          options={[
            { value: 'system', label: t('settings.language.system') },
            ...LANGS.map((l) => ({ value: l, label: LANG_NAMES[l], lang: l })),
          ]}
        />
        <p className="settings-now">
          {t('settings.now', { value: LANG_NAMES[getLang()] })}
          {langPref === 'system' && ` · ${t('settings.language.followsBrowser')}`}
        </p>
      </section>

      <section className="card">
        <h2>{t('settings.files')}</h2>
        <Switch
          checked={imageOriginal}
          onChange={setImageOriginal}
          label={t('settings.imageOriginal')}
          description={t('settings.imageOriginal.desc')}
        />
        <FileStorage connected={!!sync.account} />
      </section>

      <section className="card">
        <h2>{t('common.trash')}</h2>
        <Switch
          checked={trashAuto}
          onChange={setTrashAutoEmpty}
          label={t('trash.autoEmpty')}
          description={t('trash.autoEmpty.desc')}
        />
      </section>

      <Suspense fallback={null}>
        <IoSection />
      </Suspense>

      <AdvancedSection />

      <section className="card">
        <h2>{t('settings.about')}</h2>
        <p className="muted small">{t('settings.aboutText', { version: __APP_VERSION__ })}</p>
        <LinkButton variant="ghost" icon={Trash2} href="#/trash">
          {t('common.trash')}
        </LinkButton>
      </section>
    </div>
  )
}

const flagNames = Object.keys(FLAGS) as FlagName[]

function FlagSwitch({ name }: { name: FlagName }) {
  const on = useFlag(name)
  const def: { label: MessageKey; description?: MessageKey } = FLAGS[name]
  return (
    <Switch
      checked={on}
      onChange={(v) => setFlag(name, v)}
      label={t(def.label)}
      description={def.description && t(def.description)}
    />
  )
}

/** ST-12: developer options and feature flags (per device). */
function AdvancedSection() {
  const dev = flagNames.filter((n) => FLAGS[n].kind === 'dev')
  const features = flagNames.filter((n) => (FLAGS[n].kind as string) === 'feature')
  return (
    <section className="card">
      <h2>{t('settings.advanced')}</h2>
      <h3 className="card-sub">{t('settings.devOptions')}</h3>
      {dev.map((n) => (
        <FlagSwitch key={n} name={n} />
      ))}
      <h3 className="card-sub">{t('settings.experiments')}</h3>
      {features.length ? (
        features.map((n) => <FlagSwitch key={n} name={n} />)
      ) : (
        <p className="muted small">{t('settings.noExperiments')}</p>
      )}
    </section>
  )
}

const loadCleanup = () => import('@/core/files/cleanup')
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`

/** Device file cache size and "clean up storage" (SY-04, M3-10). */
function FileStorage({ connected }: { connected: boolean }) {
  const [bytes, setBytes] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    void loadCleanup()
      .then((m) => m.cacheBytes())
      .then(
        (n) => alive && setBytes(n),
        () => alive && setBytes(0),
      )
    return () => {
      alive = false
    }
  }, [busy])

  const run = async () => {
    const ok = await confirmDialog({
      title: t('cleanup.title'),
      message: t('cleanup.confirm'),
      confirmLabel: t('cleanup.run'),
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    const m = await loadCleanup()
    try {
      const r = await m.cleanupRepository()
      toast(r.removed ? t('cleanup.done', { removed: r.removed, kept: r.kept }) : t('cleanup.nothing'))
    } catch (e) {
      const reason = e instanceof m.CleanupError ? e.reason : null
      toast(
        reason === 'offline'
          ? t('files.offline')
          : reason === 'sync-failed'
            ? t('cleanup.syncFailed')
            : e instanceof Error
              ? e.message
              : String(e),
        { tone: 'error' },
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="settings-files">
      <p className="muted small">{t('cleanup.cache', { size: bytes === null ? '…' : mb(bytes) })}</p>
      <Button size="sm" disabled={!connected || busy} onClick={() => void run()}>
        {busy ? t('cleanup.running') : t('cleanup.title')}
      </Button>
      <p className="muted small">{connected ? t('cleanup.hint') : t('cleanup.needsGithub')}</p>
      {connected && (
        <Suspense fallback={null}>
          <RepoHistory />
        </Suspense>
      )}
    </div>
  )
}

const loadHistory = () => import('@/core/files/history')
const historyMessages = loadHistoryMessages()

/** Repository size and "clean up repository history" (SY-03, M6-09). */
function RepoHistory() {
  use(historyMessages)
  const [size, setSize] = useState<number | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState(0)
  useEffect(() => {
    let alive = true
    void loadHistory()
      .then((m) => {
        if (alive) setWarn(m.SIZE_WARN_BYTES)
        return m.repositorySize()
      })
      .then(
        (n) => alive && setSize(n),
        () => alive && setSize(null),
      )
    return () => {
      alive = false
    }
  }, [busy])
  const run = async () => {
    const ok = await confirmDialog({
      title: ht('history.confirmTitle'),
      message: ht('history.confirm'),
      confirmLabel: ht('history.confirmRun'),
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    const m = await loadHistory()
    const files = await loadCleanup()
    try {
      const r = await m.cleanHistory()
      toast(r === 'done' ? ht('history.done') : r === 'moved' ? ht('history.moved') : ht('history.empty'), {
        tone: r === 'moved' ? 'error' : undefined,
      })
    } catch (e) {
      const reason = e instanceof files.CleanupError ? e.reason : null
      toast(
        reason === 'offline' ? t('files.offline') : reason === 'sync-failed' ? t('cleanup.syncFailed') : String(e),
        { tone: 'error' },
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="settings-history">
      <p className="muted small">
        {size === undefined ? '…' : size === null ? ht('history.sizeUnknown') : ht('history.size', { size: mb(size) })}
      </p>
      {!!size && !!warn && size > warn && <p className="small settings-warn">{ht('history.big')}</p>}
      <Button size="sm" disabled={busy} onClick={() => void run()}>
        {busy ? ht('history.running') : ht('history.run')}
      </Button>
      <p className="muted small">{ht('history.hint')}</p>
    </div>
  )
}
