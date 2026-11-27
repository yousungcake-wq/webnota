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
  it('rejects other pages and schemes', () => {
    expect(videoSource('https://example.com/watch?v=x')).toBeNull()
    expect(videoSource('javascript:alert(1)//.mp4')).toBeNull()
    expect(videoSource('https://www.youtube.com/watch?v=<script>')).toBeNull()
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
  it('refuses anything else (no arbitrary iframes), http, and look-alike hosts', () => {
    expect(embedSource('https://evil.example/embed')).toBeNull()
    expect(embedSource('http://codepen.io/a/pen/b')).toBeNull()
    expect(embedSource('https://figma.com.evil.example/file/abc')).toBeNull()
    expect(embedSource('https://www.google.com/maps/place/Seoul')).toBeNull()
    expect(embedSource('data:text/html,<script>')).toBeNull()
  })
})
