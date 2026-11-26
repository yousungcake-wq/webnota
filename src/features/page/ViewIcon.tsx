import { FileText } from 'lucide-react'
import type { IconValue } from '@/core/model/views'

/**
 * Renders a view or space icon (spec/02 IconValue). Emoji and files render directly;
 * named icons (`type: 'icon'`) need the icon picker's lazy icon set (M1-14) — until it
 * is loaded they fall back to the default.
 */
export function ViewIcon({ icon, size = 16 }: { icon: IconValue | null; size?: number }) {
  if (icon?.type === 'emoji') return <>{icon.value}</>
  if (icon?.type === 'file')
    return <img src={icon.value} alt="" width={size} height={size} style={{ objectFit: 'cover', borderRadius: 3 }} />
  return <FileText size={size} />
}

export const emoji = (value: string): IconValue | null => (value ? { type: 'emoji', value } : null)
