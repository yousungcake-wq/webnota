import { t, type MessageKey } from '@/core/i18n'
import { Button, Dialog } from '@/ui'
import { isMac } from './shortcuts'

const M = isMac ? '⌘' : 'Ctrl+'
const ALT = isMac ? '⌥' : 'Alt+'
const SHIFT = isMac ? '⇧' : 'Shift+'
const LIST: [string, MessageKey][] = [
  [`${M}K`, 'shortcuts.search'],
  [`${M}N / ${M}${ALT}N`, 'shortcuts.newPage'],
  [`${M}\\`, 'shortcuts.sidebar'],
  [`${M}${SHIFT}L`, 'shortcuts.theme'],
  [`${M}[ / ${M}]`, 'shortcuts.backForward'],
  ['F2', 'shortcuts.rename'],
  [`${ALT}${SHIFT}↑ ↓ ← →`, 'shortcuts.moveRow'],
  [`${M}/`, 'shortcuts.help'],
]

/** ⌘/ — list of shortcuts (WS-14). Lazy. */
export default function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      title={t('shortcuts.title')}
      onClose={onClose}
      actions={<Button onClick={onClose}>{t('common.close')}</Button>}
    >
      <dl className="shortcut-list">
        {LIST.map(([keys, label]) => (
          <div key={label}>
            <dt>{t(label)}</dt>
            <dd>
              <kbd>{keys}</kbd>
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  )
}
