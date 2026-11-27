import { describe, expect, it } from 'vitest'
import { embedSource, videoSource } from './nodes/embedUrls'

describe('video sources (ED-B13)', () => {
  it('YouTube: watch, short link, shorts, embed; start time kept; privacy-enhanced host', () => {
    const want = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
    expect(videoSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.src).toBe(want)
    expect(videoSource('https://youtu.be/dQw4w9WgXcQ?si=abc')?.src).toBe(want)
    expect(videoSource('https://m.youtube.com/shorts/dQw4w9WgXcQ')?.src).toBe(want)
    expect(videoSource('https://youtu.be/dQw4w9WgXcQ?t=1m30s')?.src).toBe(`${want}?start=90`)
  })
  it('Vimeo, direct files and workspace video files', () => {
    expect(videoSource('https://vimeo.com/76979871')?.src).toBe('https://player.vimeo.com/video/76979871')
    expect(videoSource('https://example.com/a/clip.MP4')).toEqual({
      kind: 'file',
      src: 'https://example.com/a/clip.MP4',
    })
    expect(videoSource(`${'c'.repeat(64)}.mp4`)?.kind).toBe('file')
  })
  it('other pages are tried as they are; other schemes are refused (feedback 2-2)', () => {
    expect(videoSource('https://example.com/watch?v=x')).toMatchObject({ kind: 'iframe', generic: true })
    expect(videoSource('javascript:alert(1)//.mp4')).toBeNull()
    expect(videoSource('https://www.youtube.com/watch?v=<script>')).toMatchObject({ provider: 'web' }) // not a player id
  })
})

describe('embed allowlist (ED-B22)', () => {
  it('builds embed addresses only from parsed ids', () => {
    expect(embedSource('https://www.figma.com/design/AbC123/My-File?node-id=1-2')?.src).toBe(
      'https://www.figma.com/embed?embed_host=webnota&url=' +
        encodeURIComponent('https://www.figma.com/design/AbC123/My-File?node-id=1-2'),
    )
    expect(embedSource('https://codepen.io/someone/pen/abcDEF')?.src).toBe(
      'https://codepen.io/someone/embed/abcDEF?default-tab=result',
    )
    expect(embedSource('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC')).toMatchObject({
      src: 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC',
      height: 152,
    })
    expect(embedSource('https://www.google.com/maps/embed?pb=!1m18!2m3')?.provider).toBe('maps')
    expect(embedSource('https://www.loom.com/share/0123456789abcdef0123456789abcdef')?.src).toBe(
      'https://www.loom.com/embed/0123456789abcdef0123456789abcdef',
    )
    expect(embedSource('https://youtu.be/dQw4w9WgXcQ')?.provider).toBe('youtube')
  })
  it('any other https page is embedded as it is; http is upgraded; look-alikes are not the service', () => {
    expect(embedSource('https://evil.example/embed')).toMatchObject({
      provider: 'web',
      generic: true,
      src: 'https://evil.example/embed',
    })
    expect(embedSource('http://codepen.io/a/pen/b')?.src).toBe('https://codepen.io/a/embed/b?default-tab=result')
    expect(embedSource('https://figma.com.evil.example/file/abc')).toMatchObject({ provider: 'web' })
    expect(embedSource('data:text/html,<script>')).toBeNull()
    expect(embedSource('javascript:alert(1)')).toBeNull()
    expect(embedSource('not a link')).toBeNull()
  })
  it('many services through their official embed address (feedback 2-2)', () => {
    const src = (u: string) => embedSource(u)?.src
    expect(src('https://www.google.com/maps/place/Seoul+Station/@37.55,126.97,17z')).toBe(
      'https://maps.google.com/maps?q=Seoul%20Station&output=embed',
    )
    expect(src('https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit')).toBe(
      'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/preview',
    )
    expect(src('https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/edit#slide=1')).toBe(
      'https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/embed',
    )
    expect(src('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view')).toBe(
      'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview',
    )
    expect(src('https://x.com/someone/status/1234567890')).toBe(
      'https://platform.twitter.com/embed/Tweet.html?id=1234567890',
    )
    expect(src('https://www.instagram.com/p/CxYz123/')).toBe('https://www.instagram.com/p/CxYz123/embed')
    expect(src('https://soundcloud.com/artist/track')).toContain('w.soundcloud.com/player/?url=')
    expect(src('https://tv.naver.com/v/12345678')).toBe('https://tv.naver.com/embed/12345678')
    expect(src('https://gist.github.com/user/0123abcd')).toBe('https://gist.github.com/user/0123abcd.pibb')
    expect(src('<iframe width="560" src="https://www.youtube.com/embed/dQw4w9WgXcQ" frameborder="0"></iframe>')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    )
    expect(src('youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })
})
