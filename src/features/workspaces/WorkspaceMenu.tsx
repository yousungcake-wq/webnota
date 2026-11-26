import { Plus, Settings2 } from 'lucide-react'
import { currentWorkspaceId, listSlots, switchSlot } from '@/core/docs/slots'
import { t } from '@/core/i18n'
import { navigate } from '@/core/store/router'
import { Menu, type MenuEntry } from '@/ui'
import { slotLabel, useWorkspaceName } from './WorkspaceSwitcher'

/** Workspace list + new / settings (WS-01). Lazy. */
export default function WorkspaceMenu({
  anchor,
  onClose,
  onNew,
}: {
  anchor: HTMLElement
  onClose: () => void
  onNew: () => void
}) {
  const current = currentWorkspaceId()
  const currentName = useWorkspaceName()
  const items: MenuEntry[] = [
    ...listSlots().map((s) => ({
      label: `${s.icon ? `${s.icon} ` : ''}${s.id === current ? currentName : slotLabel(s)}`,
      checked: s.id === current,
      onSelect: () => switchSlot(s.id),
    })),
    'separator',
    { label: t('ws.new'), icon: Plus, onSelect: onNew },
    { label: t('ws.settings'), icon: Settings2, onSelect: () => navigate({ name: 'settings' }) },
  ]
  return <Menu anchor={anchor} title={t('ws.title')} items={items} onClose={onClose} />
}
