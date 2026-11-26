import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { completeLoginFromUrl } from './auth/auth'
import { openDoc, pageDocName } from './store/docs'
import { initWorkspace, seedIfEmpty } from './store/workspace'
import { connect, startAutoSync } from './sync/controller'
import { applyTheme, navigate } from './ui/hooks'
import './styles.css'

applyTheme()
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme())

async function boot() {
  const root = createRoot(document.getElementById('root')!)
  await initWorkspace()

  const welcome = seedIfEmpty()
  if (welcome) {
    const { seedWelcome } = await import('./editor/seed') // editor schema is a lazy chunk
    seedWelcome(await openDoc(pageDocName(welcome)))
    navigate({ name: 'page', id: welcome }, { replace: true })
  }

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  // Returning from GitHub's OAuth page?
  try {
    const token = await completeLoginFromUrl()
    if (token) {
      navigate({ name: 'settings' }, { replace: true })
      await connect(token)
    }
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e))
  }
  startAutoSync()

  // Warm the editor chunk once the shell is idle.
  const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500))
  idle(() => void import('./ui/PageView').then((m) => m.preloadEditor()))

  // Ask the browser not to evict our IndexedDB data under storage pressure.
  void navigator.storage?.persist?.()
}

void boot()
