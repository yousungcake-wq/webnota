import { FileText } from 'lucide-react'
import { ICONS } from './icons'

/** Renders `{ type: 'icon' }` values; unknown names (newer app) fall back to the page icon. */
export default function NamedIcon({ name, color, size }: { name: string; color?: string; size: number }) {
  const Icon = ICONS[name] ?? FileText
  return <Icon size={size} style={color ? { color: `var(--c-${color}-text)` } : undefined} />
}
