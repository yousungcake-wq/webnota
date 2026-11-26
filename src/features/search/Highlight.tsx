/** Wraps occurrences of `terms` (case-insensitive) in <mark>. */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const words = [...new Set(terms.filter(Boolean))].sort((a, b) => b.length - a.length)
  if (!words.length) return <>{text}</>
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return <>{text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}</>
}
