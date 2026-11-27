import { disassemble, getChoseong } from 'es-hangul'

/**
 * Korean-aware matching for every search in the app (titles, menus, full text), using
 * Toss's es-hangul: a syllable still being typed matches (`삭` finds `사과`, since ㅅㅏㄱ
 * starts ㅅㅏㄱㅗㅏ) and initial consonants alone search by 초성 (`ㅎㅇㄹ` finds `회의록`).
 */

const CHOSEONG_ONLY = /^[\u3131-\u314e]+$/ // ㄱ–ㅎ
const SYLLABLE = /[\uac00-\ud7a3]/ // 가–힣
const HANGUL = /\p{Script=Hangul}/u

/** [start, end) of the first match of one query word in `text`, or null. */
export function matchRange(text: string, word: string): [number, number] | null {
  const q = word.trim().toLowerCase()
  if (!q) return null
  const t = text.toLowerCase()
  const direct = t.indexOf(q)
  if (direct >= 0) return [direct, direct + q.length]
  if (!HANGUL.test(q)) return null
  const chars = [...t]
  const offsets: number[] = []
  let o = 0
  for (const ch of chars) {
    offsets.push(o)
    o += ch.length
  }
  offsets.push(o)

  if (CHOSEONG_ONLY.test(q)) {
    // 초성: compare the first consonant of each syllable (other characters as they are)
    const cho = chars.map((ch) => (SYLLABLE.test(ch) ? getChoseong(ch) : ch))
    for (let i = 0; i + q.length <= cho.length; i++) {
      let ok = true
      for (let j = 0; j < q.length && ok; j++) ok = cho[i + j] === q[j]
      if (ok) return [offsets[i]!, offsets[i + q.length]!]
    }
    return null
  }

  // jamo: the query's jamo must start at a syllable and may end inside one (still typing)
  const jamo = chars.map((ch) => disassemble(ch))
  const qj = disassemble(q)
  for (let i = 0; i < chars.length; i++) {
    let rest = qj
    let j = i
    while (rest && j < chars.length) {
      const part = jamo[j]!
      if (rest.length >= part.length) {
        if (!rest.startsWith(part)) break
        rest = rest.slice(part.length)
      } else {
        if (!part.startsWith(rest)) break
        rest = ''
      }
      j++
    }
    if (!rest) return [offsets[i]!, offsets[j]!]
  }
  return null
}

/** Ranges for every word of the query (all must match), or null if one doesn't. */
export function hangulMatchesAll(text: string, query: string): [number, number][] | null {
  const ranges: [number, number][] = []
  for (const w of query.split(/\s+/).filter(Boolean)) {
    const r = matchRange(text, w)
    if (!r) return null
    ranges.push(r)
  }
  return ranges
}

export const hangulIncludes = (text: string, query: string) => hangulMatchesAll(text, query) !== null

const split = (s: string) =>
  s
    .toLowerCase()
    .split(/[\s\p{P}\p{S}]+/u)
    .filter(Boolean)

/**
 * Index-time tokens: each word, plus for Korean words the jamo of every suffix (so a
 * prefix query finds text inside compounds) and the 초성 of every suffix.
 */
export function searchTokens(text: string): string[] {
  const out: string[] = []
  for (const raw of split(text)) {
    out.push(raw)
    if (!HANGUL.test(raw)) continue
    const chars = [...raw]
    for (let i = 0; i < chars.length; i++) {
      const suffix = chars.slice(i).join('')
      const j = disassemble(suffix)
      if (j !== raw) out.push(j)
      if (SYLLABLE.test(suffix)) {
        const cho = getChoseong(suffix)
        if (cho.length >= 2) out.push(cho)
      }
    }
  }
  return out
}

/** Query-time tokens, matched as prefixes against `searchTokens`. */
export function queryTokens(query: string): string[] {
  return split(query).map((w) => (CHOSEONG_ONLY.test(w) || !HANGUL.test(w) ? w : disassemble(w)))
}
