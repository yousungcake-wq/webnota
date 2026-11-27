import { describe, expect, it } from 'vitest'
import { isFetchable, parseMeta } from '../../worker/src/unfurl'

describe('worker /unfurl: metadata (ED-B21, M3-08)', () => {
  it('prefers Open Graph, falls back to Twitter and plain HTML, absolutizes URLs', () => {
    const html = `<html><head>
      <title>Plain &amp; title</title>
      <meta name="description" content="plain description">
      <meta property="og:title" content="OG &quot;title&quot;" />
      <meta property='og:image' content='/img/cover.png'>
      <meta property="og:site_name" content="Example">
      <link rel="shortcut icon" href="/fav.png">
    </head><body>…</body></html>`
    expect(parseMeta(html, 'https://www.example.com/a/b')).toEqual({
      url: 'https://www.example.com/a/b',
      title: 'OG "title"',
      description: 'plain description',
      image: 'https://www.example.com/img/cover.png',
      siteName: 'Example',
      icon: 'https://www.example.com/fav.png',
    })
  })
  it('uses the host when the page has nothing; drops non-http images', () => {
    const r = parseMeta('<meta property="og:image" content="javascript:alert(1)">', 'https://blog.example.org/x')
    expect(r).toMatchObject({ title: 'blog.example.org', siteName: 'blog.example.org', image: null, description: '' })
    expect(r.icon).toBe('https://blog.example.org/favicon.ico')
  })
  it('decodes numeric entities and clips long text', () => {
    const r = parseMeta(`<title>&#54620;&#xAE00; ${'x'.repeat(300)}</title>`, 'https://k.example/')
    expect(r.title.startsWith('한글 ')).toBe(true)
    expect(r.title.length).toBe(200)
  })
})

describe('worker /unfurl: what it may fetch (SSRF)', () => {
  it('allows public http(s) hosts on default ports', () => {
    expect(isFetchable('https://example.com/page')).not.toBeNull()
    expect(isFetchable('http://news.example.co.kr:80/a')).not.toBeNull()
  })
  it('refuses local names, private/link-local IPs, credentials, other ports and schemes', () => {
    for (const bad of [
      'http://localhost/',
      'http://intranet/',
      'http://printer.local/',
      'http://127.0.0.1/',
      'http://10.1.2.3/',
      'http://172.20.0.1/',
      'http://192.168.0.1/',
      'http://169.254.169.254/latest/meta-data',
      'http://100.100.0.1/',
      'http://[::1]/',
      'http://[fd00::1]/',
      'http://[::ffff:127.0.0.1]/',
      'https://user:pw@example.com/',
      'https://example.com:8443/',
      'ftp://example.com/',
      'file:///etc/passwd',
    ])
      expect(isFetchable(bad), bad).toBeNull()
  })
})
