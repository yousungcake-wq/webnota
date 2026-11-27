/**
 * URL → player/embed address for video (ED-B13) and embed (ED-B22) blocks. Only the
 * services below are ever put in an iframe (allowlist); everything is rebuilt from the
 * parsed id, so no part of a pasted URL other than the id reaches the iframe `src`.
 */
export type VideoSource = { kind: 'iframe'; provider: 'youtube' | 'vimeo'; src: string } | { kind: 'file'; src: string }

export interface EmbedSource {
  provider: string
  src: string
  /** Default iframe height in px. */
  height: number
}

const ID = /^[A-Za-z0-9_-]+$/

function parse(raw: string): URL | null {
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null
  } catch {
    return null
  }
}

const host = (u: URL) => u.hostname.replace(/^(www|m)\./, '')

function youtubeId(u: URL): string | null {
  const h = host(u)
  let id: string | null = null
  if (h === 'youtu.be') id = u.pathname.slice(1).split('/')[0] ?? null
  else if (h === 'youtube.com' || h === 'youtube-nocookie.com' || h === 'music.youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v')
    else {
      const m = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(u.pathname)
      id = m?.[1] ?? null
    }
  }
  return id && ID.test(id) && id.length <= 20 ? id : null
}

/** "1m30s", "90" → seconds. */
function youtubeStart(u: URL): number {
  const t = u.searchParams.get('t') ?? u.searchParams.get('start')
  if (!t) return 0
  if (/^\d+$/.test(t)) return Number(t)
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t)
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0
}

function vimeoId(u: URL): string | null {
  const h = host(u)
  if (h !== 'vimeo.com' && h !== 'player.vimeo.com') return null
  const m = /\/(?:video\/)?(\d{5,12})(?:\/|$)/.exec(u.pathname)
  return m?.[1] ?? null
}

const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v)$/i
const FILE_ID = /^[0-9a-f]{64}\.(mp4|webm|ogv|ogg|mov|m4v)$/

/** YouTube / Vimeo player, a direct video file URL, or a workspace video file id. */
export function videoSource(raw: string): VideoSource | null {
  if (FILE_ID.test(raw)) return { kind: 'file', src: raw }
  const u = parse(raw)
  if (!u) return null
  const yt = youtubeId(u)
  if (yt) {
    const start = youtubeStart(u)
    return {
      kind: 'iframe',
      provider: 'youtube',
      src: `https://www.youtube-nocookie.com/embed/${yt}${start ? `?start=${start}` : ''}`,
    }
  }
  const vm = vimeoId(u)
  if (vm) return { kind: 'iframe', provider: 'vimeo', src: `https://player.vimeo.com/video/${vm}` }
  if (VIDEO_EXT.test(u.pathname)) return { kind: 'file', src: u.href }
  return null
}

/** Allowlisted embeds: YouTube, Vimeo, Figma, Google Maps, CodePen, Spotify, Loom. */
export function embedSource(raw: string): EmbedSource | null {
  const u = parse(raw)
  if (!u || u.protocol !== 'https:') return null
  const h = host(u)
  const video = videoSource(raw)
  if (video?.kind === 'iframe') return { provider: video.provider, src: video.src, height: 400 }
  if (h === 'figma.com' && /^\/(file|design|proto|board)\/[A-Za-z0-9]+/.test(u.pathname)) {
    const clean = `https://www.figma.com${u.pathname}${u.search}`
    return {
      provider: 'figma',
      src: `https://www.figma.com/embed?embed_host=webnota&url=${encodeURIComponent(clean)}`,
      height: 450,
    }
  }
  if ((h === 'google.com' || h === 'maps.google.com') && u.pathname === '/maps/embed' && u.searchParams.get('pb')) {
    return {
      provider: 'maps',
      src: `https://www.google.com/maps/embed?pb=${encodeURIComponent(u.searchParams.get('pb')!)}`,
      height: 400,
    }
  }
  if (h === 'codepen.io') {
    const m = /^\/([A-Za-z0-9_-]+)\/(?:pen|embed|full|details)\/([A-Za-z0-9]+)/.exec(u.pathname)
    if (m)
      return { provider: 'codepen', src: `https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result`, height: 400 }
  }
  if (h === 'open.spotify.com') {
    const m = /^\/(?:embed\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/.exec(u.pathname)
    if (m)
      return {
        provider: 'spotify',
        src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`,
        height: m[1] === 'track' || m[1] === 'episode' ? 152 : 380,
      }
  }
  if (h === 'loom.com') {
    const m = /^\/(?:share|embed)\/([0-9a-f]{32})/.exec(u.pathname)
    if (m) return { provider: 'loom', src: `https://www.loom.com/embed/${m[1]}`, height: 400 }
  }
  return null
}
