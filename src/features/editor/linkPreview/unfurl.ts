/**
 * Page metadata for link previews (ED-B21) from the worker's `/unfurl` (M3-08). The worker
 * is the same one that exchanges OAuth codes (`VITE_AUTH_PROXY_URL`); QA can point to
 * another with localStorage `webnota:worker-url`. Without a worker, or when it fails, the
 * card shows the host name only.
 */
export interface PreviewMeta {
  title: string
  description: string
  image: string | null
  siteName: string
}

export function workerBase(): string | null {
  let override: string | null = null
  try {
    override = localStorage.getItem('webnota:worker-url')
  } catch {
    /* no storage */
  }
  const base = override || (import.meta.env.VITE_AUTH_PROXY_URL as string | undefined)
  return base ? base.replace(/\/$/, '') : null
}

const http = (v: unknown): string | null => (typeof v === 'string' && /^https?:\/\/\S+$/i.test(v) ? v : null)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export async function fetchPreview(url: string): Promise<PreviewMeta> {
  const host = hostOf(url)
  const fallback: PreviewMeta = { title: host, description: '', image: null, siteName: host }
  const base = workerBase()
  if (!base) return fallback
  try {
    const res = await fetch(`${base}/unfurl?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return fallback
    const d = (await res.json()) as Record<string, unknown>
    return {
      title: str(d.title, 200) || host,
      description: str(d.description, 400),
      image: http(d.image),
      siteName: str(d.siteName, 80) || host,
    }
  } catch {
    return fallback
  }
}
