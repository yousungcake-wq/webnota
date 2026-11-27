/**
 * URL → player/embed address for video (ED-B13) and embed (ED-B22) blocks.
 *
 * Known services are rebuilt from the parsed id into their official embed address (and
 * YouTube into its privacy-enhanced host). Any other https page is tried as it is
 * (feedback 2-2: "as many links as possible"): the iframe is sandboxed without top
 * navigation, and the block offers "open in a new tab" for sites that refuse to be framed.
 * An `<iframe src="…">` embed code is accepted too.
 */
export type VideoSource =
  { kind: 'iframe'; provider: string; src: string; generic?: boolean } | { kind: 'file'; src: string }

export interface EmbedSource {
  provider: string
  src: string
  /** Default iframe height in px. */
  height: number
  /** Not a known service: the page itself, which may refuse to be shown in a frame. */
  generic?: boolean
}

const ID = /^[A-Za-z0-9_-]+$/

/** The src of a pasted `<iframe …>` embed code, else the text itself. */
function unwrapEmbedCode(raw: string): string {
  const m = /<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(raw)
  return (m ? m[1]! : raw).trim().replace(/&amp;/g, '&')
}

function parse(raw: string): URL | null {
  const text = unwrapEmbedCode(raw)
  try {
    // "youtube.com/watch?v=…" without a scheme
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.includes('.')) return null
    return u
  } catch {
    return null
  }
}

const host = (u: URL) => u.hostname.replace(/^(www|m|mobile)\./, '')
const parentHost = () => (typeof location !== 'undefined' && location.hostname ? location.hostname : 'localhost')

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

/** Video services other than YouTube / Vimeo: their player address. */
function otherPlayer(u: URL): { provider: string; src: string } | null {
  const h = host(u)
  const p = u.pathname
  let m: RegExpExecArray | null
  if ((h === 'dailymotion.com' || h === 'dai.ly') && (m = /(?:\/video\/|^\/)([a-z0-9]{5,12})/i.exec(p)))
    return { provider: 'dailymotion', src: `https://www.dailymotion.com/embed/video/${m[1]}` }
  if (h === 'twitch.tv' || h === 'clips.twitch.tv') {
    const parent = `parent=${encodeURIComponent(parentHost())}`
    if (h === 'clips.twitch.tv' && (m = /^\/([A-Za-z0-9_-]+)/.exec(p)))
      return { provider: 'twitch', src: `https://clips.twitch.tv/embed?clip=${m[1]}&${parent}` }
    if ((m = /^\/[^/]+\/clip\/([A-Za-z0-9_-]+)/.exec(p)))
      return { provider: 'twitch', src: `https://clips.twitch.tv/embed?clip=${m[1]}&${parent}` }
    if ((m = /^\/videos\/(\d+)/.exec(p)))
      return { provider: 'twitch', src: `https://player.twitch.tv/?video=${m[1]}&${parent}&autoplay=false` }
    if ((m = /^\/([A-Za-z0-9_]{3,25})\/?$/.exec(p)))
      return { provider: 'twitch', src: `https://player.twitch.tv/?channel=${m[1]}&${parent}&autoplay=false` }
  }
  if (h === 'bilibili.com' && (m = /\/video\/(BV[A-Za-z0-9]+)/.exec(p)))
    return { provider: 'bilibili', src: `https://player.bilibili.com/player.html?bvid=${m[1]}&autoplay=0` }
  if (h === 'tv.naver.com' && (m = /\/(?:v|embed)\/(\d+)/.exec(p)))
    return { provider: 'navertv', src: `https://tv.naver.com/embed/${m[1]}` }
  if (h === 'tv.kakao.com' && (m = /\/(?:cliplink|v)\/(\d+)/.exec(p)))
    return { provider: 'kakaotv', src: `https://play-tv.kakao.com/embed/player/cliplink/${m[1]}` }
  if (h === 'streamable.com' && (m = /^\/(?:e\/)?([a-z0-9]+)/i.exec(p)))
    return { provider: 'streamable', src: `https://streamable.com/e/${m[1]}` }
  if (h === 'loom.com' && (m = /^\/(?:share|embed)\/([0-9a-f]{32})/.exec(p)))
    return { provider: 'loom', src: `https://www.loom.com/embed/${m[1]}` }
  if (h === 'tiktok.com' && (m = /\/video\/(\d+)/.exec(p)))
    return { provider: 'tiktok', src: `https://www.tiktok.com/embed/v2/${m[1]}` }
  if ((h === 'facebook.com' || h === 'fb.watch') && (/\/videos?\//.test(p) || h === 'fb.watch' || p === '/watch'))
    return {
      provider: 'facebook',
      src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.href)}&show_text=false`,
    }
  if (h === 'instagram.com' && (m = /^\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/.exec(p)))
    return { provider: 'instagram', src: `https://www.instagram.com/p/${m[1]}/embed` }
  return null
}

const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v)$/i
const FILE_ID = /^[0-9a-f]{64}\.(mp4|webm|ogv|ogg|mov|m4v)$/

/** A video player, a direct video file URL, a workspace video file id, or any other page. */
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
  const other = otherPlayer(u)
  if (other) return { kind: 'iframe', ...other }
  const page = embedSource(raw)
  return page ? { kind: 'iframe', provider: page.provider, src: page.src, generic: page.generic } : null
}

const GOOGLE_DOC = /^\/(document|spreadsheets|presentation|forms|drawings)\/d\/(e\/)?([A-Za-z0-9_-]{10,})/

/** Embed address of a page: a known service's embed, or the page itself (https). */
export function embedSource(raw: string): EmbedSource | null {
  const u = parse(raw)
  if (!u) return null
  if (u.protocol === 'http:') u.protocol = 'https:' // an http frame would be blocked on an https page
  const h = host(u)
  const p = u.pathname
  let m: RegExpExecArray | null
  const yt = youtubeId(u)
  const vm = vimeoId(u)
  if (yt || vm) {
    const v = videoSource(raw)
    if (v?.kind === 'iframe') return { provider: v.provider, src: v.src, height: 400 }
  }
  const player = otherPlayer(u)
  if (player)
    return {
      ...player,
      height: player.provider === 'tiktok' ? 740 : player.provider === 'instagram' ? 640 : 400,
    }
  if (h === 'figma.com' && /^\/(file|design|proto|board|slides)\/[A-Za-z0-9]+/.test(p)) {
    const clean = `https://www.figma.com${p}${u.search}`
    return {
      provider: 'figma',
      src: `https://www.figma.com/embed?embed_host=webnota&url=${encodeURIComponent(clean)}`,
      height: 450,
    }
  }
  if (h === 'google.com' || h === 'maps.google.com' || h === 'google.co.kr') {
    if (p === '/maps/embed' && u.searchParams.get('pb'))
      return {
        provider: 'maps',
        src: `https://www.google.com/maps/embed?pb=${encodeURIComponent(u.searchParams.get('pb')!)}`,
        height: 400,
      }
    if (p.startsWith('/maps')) {
      // a place, coordinates or a search: the keyless "output=embed" map
      const place = /\/maps\/(?:place|search)\/([^/]+)/.exec(p)?.[1]
      const at = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(p)
      const q =
        u.searchParams.get('q') ??
        (place ? decodeURIComponent(place.replace(/\+/g, ' ')) : at ? `${at[1]},${at[2]}` : null)
      if (q)
        return {
          provider: 'maps',
          src: `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`,
          height: 400,
        }
    }
  }
  if (h === 'docs.google.com' && (m = GOOGLE_DOC.exec(p))) {
    const [, kind, published, id] = m
    const base = `https://docs.google.com/${kind}/d/${published ? 'e/' : ''}${id}`
    const src =
      kind === 'forms'
        ? `${base}/viewform?embedded=true`
        : kind === 'presentation'
          ? `${base}/embed`
          : published
            ? `${base}/pubhtml?widget=true&headers=false`
            : `${base}/preview`
    return { provider: 'google', src, height: kind === 'presentation' ? 420 : 600 }
  }
  if (h === 'drive.google.com' && (m = /\/file\/d\/([A-Za-z0-9_-]{10,})/.exec(p)))
    return { provider: 'google', src: `https://drive.google.com/file/d/${m[1]}/preview`, height: 480 }
  if (h === 'calendar.google.com' && p.startsWith('/calendar/embed'))
    return { provider: 'google', src: `https://calendar.google.com${p}${u.search}`, height: 600 }
  if (h === 'codepen.io' && (m = /^\/([A-Za-z0-9_-]+)\/(?:pen|embed|full|details)\/([A-Za-z0-9]+)/.exec(p)))
    return { provider: 'codepen', src: `https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result`, height: 400 }
  if (
    h === 'open.spotify.com' &&
    (m = /^\/(?:intl-[a-z]+\/)?(?:embed\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/.exec(p))
  )
    return {
      provider: 'spotify',
      src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`,
      height: m[1] === 'track' || m[1] === 'episode' ? 152 : 380,
    }
  if (h === 'soundcloud.com' && p.split('/').filter(Boolean).length >= 1)
    return {
      provider: 'soundcloud',
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(`https://soundcloud.com${p}`)}`,
      height: p.includes('/sets/') ? 450 : 166,
    }
  if (h === 'music.apple.com' || h === 'podcasts.apple.com')
    return { provider: 'apple', src: `https://embed.${h}${p}${u.search}`, height: /[?&]i=/.test(u.search) ? 175 : 450 }
  if ((h === 'twitter.com' || h === 'x.com') && (m = /\/status(?:es)?\/(\d+)/.exec(p)))
    return { provider: 'twitter', src: `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}`, height: 560 }
  if (h === 'gist.github.com' && (m = /^\/([A-Za-z0-9_-]+)\/([0-9a-f]+)/.exec(p)))
    return { provider: 'gist', src: `https://gist.github.com/${m[1]}/${m[2]}.pibb`, height: 400 }
  if (h === 'codesandbox.io' && (m = /^\/(?:s|embed|p\/sandbox|p\/devbox)\/([A-Za-z0-9_-]+)/.exec(p)))
    return { provider: 'codesandbox', src: `https://codesandbox.io/embed/${m[1]}`, height: 500 }
  if (h === 'stackblitz.com' && /^\/(edit|github)\//.test(p))
    return { provider: 'stackblitz', src: `https://stackblitz.com${p}?embed=1`, height: 500 }
  if (h === 'replit.com' && /^\/@[^/]+\/[^/]+/.test(p))
    return { provider: 'replit', src: `https://replit.com${p}?embed=true`, height: 500 }
  if (h === 'miro.com' && (m = /\/app\/board\/([^/]+)/.exec(p)))
    return { provider: 'miro', src: `https://miro.com/app/live-embed/${m[1]}/`, height: 450 }
  if (h === 'canva.com' && /^\/design\/[^/]+\/[^/]+\/(view|watch)/.test(p))
    return { provider: 'canva', src: `https://www.canva.com${p}?embed`, height: 450 }
  if (h === 'airtable.com' && (m = /^\/(?:embed\/)?((?:app[A-Za-z0-9]+\/)?shr[A-Za-z0-9]+)/.exec(p)))
    return { provider: 'airtable', src: `https://airtable.com/embed/${m[1]}`, height: 533 }
  if (h === 'desmos.com' && (m = /^\/calculator\/([a-z0-9]+)/.exec(p)))
    return { provider: 'desmos', src: `https://www.desmos.com/calculator/${m[1]}?embed`, height: 450 }
  // anything else: the page itself (it may refuse to be framed; the block offers "open")
  return { provider: 'web', src: u.href, height: 500, generic: true }
}
