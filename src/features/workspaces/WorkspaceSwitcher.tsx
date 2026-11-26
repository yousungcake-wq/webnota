import { ChevronsUpDown } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { currentSlot, wsKey, type Slot } from '@/core/docs/slots'
import { t } from '@/core/i18n'
import { useSync } from '@/core/store/sync'
import { afterMenuClosed } from '@/features/page'
import './workspaces.css'

const WorkspaceMenu = lazy(() => import('./WorkspaceMenu'))
const NewWorkspaceDialog = lazy(() => import('./NewWorkspaceDialog'))

/** A workspace's display name: its own name, else its repository, else "this device". */
export function slotLabel(slot: Slot): string {
  if (slot.name) return slot.name
  try {
    const account = JSON.parse(localStorage.getItem(wsKey('account', slot)) || 'null') as { repo?: string } | null
    if (account?.repo) return account.repo
  } catch {
    /* ignore */
  }
  return slot.legacy ? t('ws.local') : t('ws.untitled')
}

export function useWorkspaceName() {
  const account = useSync().account // re-render when connecting / disconnecting
  const slot = currentSlot()
  return slot.name || account?.repo || slotLabel(slot)
}

/** Sidebar top: current workspace; opens the workspace list (WS-01). */
export function WorkspaceSwitcher() {
  const name = useWorkspaceName()
  const slot = currentSlot()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [creating, setCreating] = useState(false)
  return (
    <>
      <button
        type="button"
        className="ws-switcher"
        aria-haspopup="menu"
        aria-label={t('ws.switch')}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        {slot.icon ? (
          <span className="ws-icon">{slot.icon}</span>
        ) : (
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={22} height={22} />
        )}
        <span className="ws-name">{name}</span>
        <ChevronsUpDown size={14} />
      </button>
      {anchor && (
        <Suspense fallback={null}>
          <WorkspaceMenu
            anchor={anchor}
            onClose={() => setAnchor(null)}
            onNew={() => void afterMenuClosed().then(() => setCreating(true))}
          />
        </Suspense>
      )}
      {creating && (
        <Suspense fallback={null}>
          <NewWorkspaceDialog onClose={() => setCreating(false)} />
        </Suspense>
      )}
    </>
  )
}
