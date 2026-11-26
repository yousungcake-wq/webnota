/**
 * Text/background colors (ED-I03). Stored values are palette ids (rendered through
 * theme tokens, so they adapt to dark mode) or a custom `#rrggbb`.
 */
export const PALETTE = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const
export type PaletteColor = (typeof PALETTE)[number]

const HEX = /^#[0-9a-f]{6}$/i

/** A storable color value, or null for anything else (unknown names, CSS expressions). */
export function normalizeColor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().toLowerCase()
  if ((PALETTE as readonly string[]).includes(v)) return v
  if (HEX.test(v)) return v
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v)
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/.exec(v)
  if (rgb) {
    const hex = rgb
      .slice(1, 4)
      .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0'))
      .join('')
    return `#${hex}`
  }
  return null
}

export const isPalette = (v: string): v is PaletteColor => (PALETTE as readonly string[]).includes(v)

/** DOM attributes for a stored color: palette → data attribute (styled by CSS), hex → inline style. */
export function colorAttrs(kind: 'text' | 'bg', value: string | null): Record<string, string> {
  if (!value) return {}
  if (isPalette(value)) return { [kind === 'text' ? 'data-text-color' : 'data-bg-color']: value }
  return { style: `${kind === 'text' ? 'color' : 'background-color'}: ${value}` }
}

/**
 * Color from pasted inline styles. Grays/black/white are dropped: documents from other
 * apps set `color: rgb(0,0,0)` on every span, which would be unreadable in dark mode.
 */
export function pastedColor(raw: string | null | undefined): string | null {
  const v = normalizeColor(raw)
  if (!v || !v.startsWith('#')) return v
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number]
  return Math.max(r, g, b) - Math.min(r, g, b) < 24 ? null : v
}

/** Stored color of a pasted/parsed element: the data attribute wins over inline style. */
export function elementColor(el: HTMLElement, kind: 'text' | 'bg'): string | null {
  const data = el.getAttribute(kind === 'text' ? 'data-text-color' : 'data-bg-color')
  if (data) return normalizeColor(data)
  return pastedColor(kind === 'text' ? el.style.color : el.style.backgroundColor)
}
