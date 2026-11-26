/** Adds a scheme to bare domains ("example.com" → https://example.com); mailto/tel/# kept. */
export function normalizeUrl(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(v)) return v
  return `https://${v}`
}
