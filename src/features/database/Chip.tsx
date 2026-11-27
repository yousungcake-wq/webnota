import type { SelectChoice } from '@/core/model/database'

/** A select option as a coloured chip (spec/05 §3.3: tokens `--sel-<color>`). */
export function Chip({ choice }: { choice: SelectChoice }) {
  return (
    <span className="db-chip" style={{ background: `var(--sel-${choice.color}, var(--sel-gray))` }}>
      {choice.name}
    </span>
  )
}
