/** Adds a scheme to bare domains ("example.com" → https://example.com); mailto/tel/# kept. */
export function normalizeUrl(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(v)) return v
  return `https://${v}`
}

/** In-app hash of a WebNota link (`#/…` or this app's URL + `#/…`), else null. */
export function internalHash(href: string, base: string): string | null {
  if (href.startsWith('#/')) return href
  const i = href.indexOf('#/')
  return i > 0 && href.slice(0, i) === base ? href.slice(i) : null
}

/** Opens a link: WebNota links (pages, blocks) navigate in place, others open a new tab. */
export function openHref(href: string) {
  const hash = internalHash(href, location.href.split('#')[0]!)
  if (hash) location.hash = hash
  else window.open(href, '_blank', 'noopener')
}
