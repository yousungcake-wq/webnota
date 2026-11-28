import { useEffect, useState, useSyncExternalStore } from 'react'
import { addMessages, getLang, tFeature } from '@/core/i18n'
import {
  canPromptInstall,
  installStore,
  isInstalled,
  isIOS,
  isStandalone,
  onInstallChange,
  promptInstall,
  visits,
} from '@/platform/install'
import { Button, confirmDialog, toast } from '@/ui'
import type { InstallKey } from './i18n/ko'
import './install.css'

const OFFERED_KEY = 'webnota:install-offered'
const MIN_VISITS = 3

let loaded: Promise<void> | null = null
export const loadInstallMessages = () =>
  (loaded ??= (async () => {
    addMessages(getLang() === 'ko' ? (await import('./i18n/ko')).ko : (await import('./i18n/en')).en)
  })())
const it = (key: InstallKey) => tFeature(key)

/** The iOS steps: Safari has no install prompt, only Share → Add to Home Screen. */
export async function showIosSteps() {
  await loadInstallMessages()
  await confirmDialog({
    title: it('install.iosTitle'),
    message: (
      <ol className="install-steps">
        <li>{it('install.iosStep1')}</li>
        <li>{it('install.iosStep2')}</li>
        <li>{it('install.iosStep3')}</li>
      </ol>
    ),
    confirmLabel: it('install.iosOk'),
    info: true,
  })
}

/**
 * Offers installing once, on a touch device from the third visit (MB-40): Android/Chrome
 * gets a toast with an install button (as soon as the browser allows it), iOS Safari the
 * steps. Nothing when already installed or opened as the app.
 */
export async function maybeOfferInstall() {
  if (isStandalone()) installStore.set('webnota:installed', '1')
  if (isInstalled() || visits() < MIN_VISITS || installStore.get(OFFERED_KEY)) return
  await loadInstallMessages()
  const offer = () => {
    installStore.set(OFFERED_KEY, '1')
    toast(it('install.ready'), {
      action: { label: it('install.button'), onClick: () => void promptInstall() },
      duration: 12000,
    })
  }
  if (canPromptInstall()) return offer()
  if (isIOS()) {
    installStore.set(OFFERED_KEY, '1')
    return showIosSteps()
  }
  // Chrome may fire beforeinstallprompt later
  const off = onInstallChange(() => {
    if (!canPromptInstall()) return
    off()
    offer()
  })
}

/** Settings card (ST, MB-40): install button, iOS steps, or "installed". */
export function InstallCard() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void loadInstallMessages().then(() => setReady(true))
  }, [])
  const can = useSyncExternalStore(onInstallChange, canPromptInstall)
  if (!ready) return null
  const installed = isInstalled()
  return (
    <section className="card">
      <h2>{it('install.title')}</h2>
      <p className="muted">{installed ? it('install.installed') : it('install.desc')}</p>
      {!installed &&
        (can ? (
          <Button variant="primary" onClick={() => void promptInstall()}>
            {it('install.settingsButton')}
          </Button>
        ) : isIOS() ? (
          <Button onClick={() => void showIosSteps()}>{it('install.iosHow')}</Button>
        ) : (
          <p className="muted">{it('install.unavailable')}</p>
        ))}
    </section>
  )
}
