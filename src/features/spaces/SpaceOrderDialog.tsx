import { ArrowDown, ArrowUp } from 'lucide-react'
import { ws } from '@/core/docs/workspace'
import { t } from '@/core/i18n'
import { listSpaces, moveSpace, visibleSpaces } from '@/core/model/views'
import { useSpaces } from '@/core/store/views'
import { Dialog, IconButton } from '@/ui'
import { SpaceBadge } from './SpaceBadge'

/** Space order with up/down buttons (feedback 7: reorder on phones too). Lazy. */
export default function SpaceOrderDialog({ onClose }: { onClose: () => void }) {
  const spaces = visibleSpaces(useSpaces())
  const move = (id: string, delta: number) => {
    const vis = spaces.map((s) => s.id)
    const i = vis.indexOf(id) + delta
    const rest = listSpaces(ws()).filter((s) => s.id !== id)
    const target = vis.filter((x) => x !== id)[i]
    moveSpace(ws(), id, target ? rest.findIndex((s) => s.id === target) : rest.length)
  }
  return (
    <Dialog title={t('space.reorder')} onClose={onClose}>
      <ol className="space-order">
        {spaces.map((s, i) => (
          <li key={s.id}>
            <SpaceBadge space={s} size={20} />
            <span className="space-name">{s.name || t('space.untitled')}</span>
            <IconButton
              icon={ArrowUp}
              label={`${s.name} ${t('space.moveUp')}`}
              disabled={i === 0}
              onClick={() => move(s.id, -1)}
            />
            <IconButton
              icon={ArrowDown}
              label={`${s.name} ${t('space.moveDown')}`}
              disabled={i === spaces.length - 1}
              onClick={() => move(s.id, 1)}
            />
          </li>
        ))}
      </ol>
    </Dialog>
  )
}
