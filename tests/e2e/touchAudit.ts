import type { Page } from '@playwright/test'

/** Minimum touch target (MB-11, spec/12). */
export const MIN_TARGET = 44

/**
 * The visible touch targets whose hit area is smaller than 44×44 (M7-02). The hit area is
 * measured by hit-testing points 22px left/right/above/below the centre, so a small icon
 * with a padded or pseudo-element-expanded hit area passes, and two cramped neighbours
 * fail. Inline links in document text are exempt (WCAG 2.5.8 inline exception), and
 * controls inside document lines (task checkboxes) only need the line's height (28px) so
 * the text keeps its spacing; targets covered by something else (behind a sheet) are skipped.
 */
export async function smallTargets(page: Page, label: string) {
  const found = await page.evaluate((min) => {
    const sel = [
      'button',
      'a[href]',
      'select',
      'textarea',
      'input:not([type=hidden]):not([type=file])',
      '[role=button]',
      '[role=menuitem]',
      '[role=menuitemcheckbox]',
      '[role=option]',
      '[role=tab]',
      '[role=checkbox]',
      '[role=switch]',
      '[role=treeitem]',
    ].join(',')
    const w = innerWidth
    const h = innerHeight
    const name = (el: Element) => {
      const n =
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        (el as HTMLElement).innerText?.trim().slice(0, 24) ||
        el.getAttribute('placeholder') ||
        ''
      const cls = (el.getAttribute('class') ?? '').split(/\s+/)[0]
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} "${n.replace(/\s+/g, ' ')}"`
    }
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if ((el as HTMLButtonElement).disabled || el.closest('[aria-hidden="true"], [inert]')) continue
      if (el.matches('a') && el.closest('.ProseMirror') && !el.closest('[contenteditable=false]')) continue
      if (el.closest('[data-touch-exempt]')) continue
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) continue
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      if (cx < 0 || cy < 0 || cx > w || cy > h) continue
      // a wrapping <label> (task checkboxes) is part of the target
      const owner = el.closest('label') ?? el
      const hits = (x: number, y: number) => {
        const p = document.elementFromPoint(Math.min(w - 1, Math.max(0, x)), Math.min(h - 1, Math.max(0, y)))
        return !!p && (p === el || el.contains(p) || owner.contains(p))
      }
      if (!hits(cx, cy)) continue // covered
      const half = min / 2 - 1 // 1px slack for subpixel layout
      const inLine = !!el.closest('.ProseMirror') && el.matches('input[type=checkbox]')
      const halfY = inLine ? 14 - 1 : half
      // a point outside the viewport cannot be hit, and one inside the target's own box is
      // the target (when covered there, it is scrolled under a bar — not a size problem)
      const inside = (x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
      // a fixed bar or panel over the edge of the target (content scrolls under it) is not a
      // neighbour: the target can be scrolled clear of it
      const fixedLayer = (n: Element | null) => {
        for (; n; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return n
        return null
      }
      const underBar = (x: number, y: number) => {
        const layer = fixedLayer(document.elementFromPoint(x, y))
        return !!layer && !layer.contains(el)
      }
      const ok = (x: number, y: number) =>
        x < 0 || y < 0 || x >= w || y >= h || inside(x, y) || hits(x, y) || underBar(x, y)
      const points: [number, number][] = [
        [cx - half, cy],
        [cx + half, cy],
        [cx, cy - halfY],
        [cx, cy + halfY],
      ]
      const miss = points.find(([x, y]) => !ok(x, y))
      if (miss) {
        // what takes the tap instead (helps fixing)
        const other = document.elementFromPoint(miss[0], miss[1])
        out.push(`${name(el)} ${Math.round(r.width)}×${Math.round(r.height)} (→ ${other ? name(other) : 'nothing'})`)
      }
    }
    return out
  }, MIN_TARGET)
  return found.map((f) => `${label}: ${f}`)
}

/** Collects audit results, each target once (the first screen it was seen on). */
export function auditLog() {
  const seen = new Map<string, string>()
  return {
    add(lines: string[]) {
      for (const l of lines) {
        const key = l.slice(l.indexOf(': ') + 2)
        if (!seen.has(key)) seen.set(key, l)
      }
    },
    get list() {
      return [...seen.values()]
    },
  }
}
