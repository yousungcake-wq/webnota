import { FileText } from 'lucide-react'
import { lazy, Suspense } from 'react'
import type { IconValue } from '@/core/model/views'
import { loadNamedIcon } from '@/features/emoji'

const NamedIcon = lazy(loadNamedIcon)

/**
 * Renders a view or space icon (spec/02 IconValue). Emoji and files render directly;
 * named icons (`type: 'icon'`) come from the lazy icon set (features/emoji).
 */
export function ViewIcon({ icon, size = 16 }: { icon: IconValue | null; size?: number }) {
  if (icon?.type === 'emoji') return <>{icon.value}</>
  if (icon?.type === 'file')
    return <img src={icon.value} alt="" width={size} height={size} style={{ objectFit: 'cover', borderRadius: 3 }} />
  if (icon?.type === 'icon')
    return (
      <Suspense fallback={<FileText size={size} />}>
        <NamedIcon name={icon.value} color={icon.color} size={size} />
      </Suspense>
    )
  return <FileText size={size} />
}

export const emoji = (value: string): IconValue | null => (value ? { type: 'emoji', value } : null)
