/**
 * Link preview metadata (ED-B21, M3-08): the parts the worker's `/unfurl` endpoint needs
 * that can be tested without the Workers runtime.
 */
export interface Unfurled {
  url: string
  title: string
  description: string
  image: string | null
  siteName: string
  icon: string | null
}

const MAX = { title: 200, description: 400, siteName: 80 }

/** Hosts the worker must never fetch (SSRF): local names, private and link-local IPs, odd ports. */
export function isFetchable(raw: string): URL | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  if (u.username || u.password) return null
  if (u.port && u.port !== '80' && u.port !== '443') return null
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!h.includes('.') && !h.includes(':')) return null // "localhost", intranet names
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(h)) return null
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    )
      return null
  }
  if (h.includes(':')) {
    // IPv6 literal: loopback, unique local, link local, IPv4-mapped
    if (h === '::1' || h === '::' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('::ffff:')) return null
  }
  return u
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }
function decode(s: string) {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
      }
      return ENTITIES[e.toLowerCase()] ?? m
    })
    .replace(/\s+/g, ' ')
    .trim()
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1]!.toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? ''
  }
  return out
}

function absolute(href: string | undefined, base: string): string | null {
  if (!href) return null
  try {
    const u = new URL(decode(href), base)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Open Graph / Twitter / plain HTML metadata from the start of a page (`<head>`). */
export function parseMeta(html: string, pageUrl: string): Unfurled {
  const head = html.slice(0, 200_000)
  const meta: Record<string, string> = {}
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0])
    const key = (a.property ?? a.name ?? '').toLowerCase()
    if (key && a.content !== undefined && !(key in meta)) meta[key] = a.content
  }
  let icon: string | null = null
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(m[0])
    if (/(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/i.test(a.rel ?? '') && a.href) {
      icon = absolute(a.href, pageUrl)
      if (icon) break
    }
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1]
  const host = new URL(pageUrl).hostname.replace(/^www\./, '')
  const title = decode(meta['og:title'] ?? meta['twitter:title'] ?? titleTag ?? '') || host
  const description = decode(meta['og:description'] ?? meta['twitter:description'] ?? meta.description ?? '')
  return {
    url: pageUrl,
    title: clip(title, MAX.title),
    description: clip(description, MAX.description),
    image: absolute(meta['og:image'] ?? meta['og:image:url'] ?? meta['twitter:image'], pageUrl),
    siteName: clip(decode(meta['og:site_name'] ?? '') || host, MAX.siteName),
    icon: icon ?? absolute('/favicon.ico', pageUrl),
  }
}
