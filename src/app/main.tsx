import '@/styles/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { completeLoginFromUrl, getToken } from '@/core/auth/auth'
import { getLang, initI18n, t } from '@/core/i18n'
import { legacyCopyDone, openDoc, pageDocName } from '@/core/docs/registry'
import { currentWorkspaceId } from '@/core/docs/slots'
import { initWorkspace, seedIfEmpty } from '@/core/docs/workspace'
import { initSchema, isReadOnly } from '@/core/schema'
import { debugFlag } from '@/platform/debug'
import { applyTheme, trashAutoEmptyStore } from '@/core/store/prefs'
import { navigate } from '@/core/store/router'
import { connect, initUser, pendingTarget, startAutoSync, syncStore } from '@/core/sync/controller'
import { loadSeed, preloadEditor } from '@/features/editor'
import { addPage, autoEmptyTrash } from '@/features/page'
import { startSearchIndexing } from '@/features/search'
import { configureUi, ErrorBoundary, OverlayHost, toast } from '@/ui'
import { App } from './App'
import { installGlobalErrorToasts } from './errors'

document.documentElement.lang = getLang()
applyTheme()
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme())

async function boot() {
  const root = createRoot(document.getElementById('root')!)
  if (debugFlag('seed-v1')) await (await import('./qa/seedV1')).seedV1() // QA: PoC-format data
  // Move PoC-era IndexedDB databases into this workspace's namespace, once per device,
  // before any doc is opened (spec/02 §7, SY-05).
  if (!legacyCopyDone()) await (await import('@/core/docs/legacy')).runLegacyDocCopy(currentWorkspaceId())
  const [wsDoc] = await Promise.all([initWorkspace(), initI18n()])
  // Migrate or gate before anything reads or writes the workspace (spec/02 §6).
  // QA: `webnota:debug=schema-newer` pretends the data is newer than this build.
  await initSchema(wsDoc, {
    ctx: { defaultSpaceName: t('space.default') },
    ...(debugFlag('schema-newer') ? { appVersion: 0 } : {}),
  })
  configureUi({
    ok: t('common.ok'),
    cancel: t('common.cancel'),
    close: t('common.close'),
    dismiss: t('common.dismiss'),
    retry: t('error.retry'),
    errorTitle: t('error.screen'),
  })
  installGlobalErrorToasts()

  await initUser()
  if (trashAutoEmptyStore.get() && !isReadOnly()) void autoEmptyTrash() // WS-06, device option
  const welcome = isReadOnly() ? null : seedIfEmpty()
  if (debugFlag('seed-unknown') && !isReadOnly()) await (await import('./qa/seedUnknown')).seedUnknown(wsDoc) // QA: ED-B23
  if (debugFlag('seed-many') && !isReadOnly()) (await import('./qa/seedMany')).seedMany(wsDoc) // QA: virtual tree
  if (welcome) {
    const { seedWelcome } = await loadSeed() // editor schema is a lazy chunk
    seedWelcome(await openDoc(pageDocName(welcome)))
    navigate({ name: 'page', id: welcome }, { replace: true })
  }
  if ((debugFlag('seed-db') || debugFlag('seed-db-10k')) && !isReadOnly()) await (await import('./qa/seedDb')).seedDb() // QA: M4 grid

  // Home-screen shortcut "new page" (MB-44): `?action=new-page`, removed from the URL.
  const action = new URLSearchParams(location.search).get('action')
  if (action) history.replaceState(history.state, '', location.pathname + location.hash)
  if (action === 'new-page' && !isReadOnly()) addPage(null)

  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <OverlayHost />
    </StrictMode>,
  )

  // Returning from GitHub's OAuth page?
  try {
    const token = await completeLoginFromUrl()
    if (token) {
      navigate({ name: 'settings' }, { replace: true })
      await connect(token)
    } else if (!syncStore.get().account && pendingTarget() && getToken()) {
      // A workspace created to open a repository connects on its first start (WS-01).
      await connect(getToken()!)
    }
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), { tone: 'error' })
  }
  startAutoSync()

  // Warm the editor chunk once the shell is idle.
  const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500))
  idle(() => {
    preloadEditor()
    startSearchIndexing() // WS-07: build/refresh the full-text index in the background
  })

  // Ask the browser not to evict our IndexedDB data under storage pressure.
  void navigator.storage?.persist?.()
}

void boot()
