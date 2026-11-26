import type { SpaceMeta } from '@/core/model/views'

export const SPACE_COLORS = ['blue', 'green', 'orange', 'purple', 'pink', 'red', 'yellow', 'brown', 'gray'] as const

/** Space icon: its emoji, or its initial on the space color (like AppFlowy). */
export function SpaceBadge({ space, size = 20 }: { space: Pick<SpaceMeta, 'name' | 'icon' | 'color'>; size?: number }) {
  const color = (SPACE_COLORS as readonly string[]).includes(space.color) ? space.color : 'blue'
  return (
    <span
      className="space-badge"
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize: size * 0.6,
        background: `var(--c-${color}-bg)`,
        color: `var(--c-${color}-text)`,
      }}
    >
      {space.icon?.type === 'emoji' ? space.icon.value : (space.name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}
