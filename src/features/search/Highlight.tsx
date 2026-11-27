import { matchRange } from '@/core/text/hangul'

/** Marks where each term matches (Korean-aware: 초성, a syllable still being typed). */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const ranges = terms
    .map((w) => matchRange(text, w))
    .filter((r): r is [number, number] => r !== null)
    .sort((a, b) => a[0] - b[0])
  if (!ranges.length) return <>{text}</>
  const out: (string | React.ReactElement)[] = []
  let at = 0
  for (const [s, e] of ranges) {
    if (e <= at) continue
    const start = Math.max(s, at)
    if (start > at) out.push(text.slice(at, start))
    out.push(<mark key={start}>{text.slice(start, e)}</mark>)
    at = e
  }
  if (at < text.length) out.push(text.slice(at))
  return <>{out}</>
}
