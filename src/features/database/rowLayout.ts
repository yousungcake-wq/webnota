/**
 * Vertical layout of grid rows (DB-G08): fixed height, or measured heights when a wrapped
 * column makes rows grow. Offsets are prefix sums; lookups are binary searches.
 */
export interface RowLayout {
  top(index: number): number
  height(index: number): number
  total: number
  /** Index of the row at `y` (clamped). */
  indexAt(y: number): number
}

export function fixedLayout(count: number, rowHeight: number): RowLayout {
  return {
    top: (i) => i * rowHeight,
    height: () => rowHeight,
    total: count * rowHeight,
    indexAt: (y) => Math.max(0, Math.min(count - 1, Math.floor(y / rowHeight))),
  }
}

export function measuredLayout(ids: string[], heights: ReadonlyMap<string, number>, minHeight: number): RowLayout {
  const tops = new Float64Array(ids.length + 1)
  for (let i = 0; i < ids.length; i++) tops[i + 1] = tops[i]! + Math.max(minHeight, heights.get(ids[i]!) ?? minHeight)
  return {
    top: (i) => tops[i]!,
    height: (i) => tops[i + 1]! - tops[i]!,
    total: tops[ids.length]!,
    indexAt(y) {
      let lo = 0
      let hi = ids.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (tops[mid]! <= y) lo = mid
        else hi = mid - 1
      }
      return Math.max(0, lo)
    },
  }
}

/** Columns intersecting [left, left + width] among the scrolling (unfrozen) ones, + overscan. */
export function visibleColumns(
  cols: { left: number; width: number; frozen: boolean }[],
  left: number,
  width: number,
  overscan = 1,
) {
  const frozenWidth = cols.filter((c) => c.frozen).reduce((n, c) => n + c.width, 0)
  let from = -1
  let to = -1
  cols.forEach((c, i) => {
    if (c.frozen) return
    if (c.left + c.width > left + frozenWidth && c.left < left + width) {
      if (from < 0) from = i
      to = i
    }
  })
  const firstUnfrozen = cols.findIndex((c) => !c.frozen)
  if (from < 0)
    return {
      from: firstUnfrozen < 0 ? cols.length : firstUnfrozen,
      to: firstUnfrozen < 0 ? cols.length - 1 : firstUnfrozen - 1,
    }
  return { from: Math.max(firstUnfrozen, from - overscan), to: Math.min(cols.length - 1, to + overscan) }
}
