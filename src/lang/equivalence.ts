/**
 * Equivalence layer: decides whether two answers say the same thing, allowing
 * synonyms, regional variants, spelling variants, optional subject pronouns and
 * bracketed optional text. Language-agnostic machinery; the groups come from
 * content (synonyms.yaml) and vocabulary variants.
 *
 * A word may belong to several groups ("chico" = niño and = pequeño); two words
 * are equivalent when they share at least one group. Multi-word members
 * ("echar de menos") are folded into a group token before comparison.
 */
import { stripAccents } from './es/normalize'

export interface Equivalence {
  /** multi-word phrase (lowercase, single spaces) → group ids */
  phrases: Map<string, number[]>
  /** single word → group ids */
  words: Map<string, Set<number>>
  maxPhraseLen: number
}

const WORD_RE = /[\p{L}\p{N}']+/gu

function keyOf(s: string): string {
  return (s.toLowerCase().match(WORD_RE) ?? []).join(' ')
}

export function buildEquivalence(groups: string[][]): Equivalence {
  const phrases = new Map<string, number[]>()
  const words = new Map<string, Set<number>>()
  let maxPhraseLen = 1
  groups.forEach((g, gid) => {
    for (const form of g) {
      for (const k of new Set([keyOf(form), stripAccents(keyOf(form))])) {
        if (!k) continue
        const n = k.split(' ').length
        if (n > 1) {
          const list = phrases.get(k) ?? []
          if (!list.includes(gid)) list.push(gid)
          phrases.set(k, list)
          maxPhraseLen = Math.max(maxPhraseLen, n)
        } else {
          const set = words.get(k) ?? new Set<number>()
          set.add(gid)
          words.set(k, set)
        }
      }
    }
  })
  return { phrases, words, maxPhraseLen }
}

/** A token after folding: a plain word, or a phrase folded into its group ids. */
type Tok = { w: string; groups: Set<number> }

/** Subject pronouns Spanish speakers routinely drop; stripped at the start of the answer. */
const ES_SUBJECTS = new Set(['yo', 'tú', 'vos', 'él', 'ella', 'usted', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'ustedes'])
const ES_EMPHATIC = new Map<string, string>([['a mí', 'me'], ['a ti', 'te'], ['a él', 'le'], ['a ella', 'le'], ['a usted', 'le'], ['a nosotros', 'nos'], ['a nosotras', 'nos'], ['a vosotros', 'os'], ['a vosotras', 'os'], ['a ellos', 'les'], ['a ellas', 'les'], ['a ustedes', 'les']])
const ES_OBJECT = new Set(['me', 'te', 'le', 'nos', 'os', 'les', 'lo', 'la', 'los', 'las', 'se'])
const ES_NOT_AFTER_SUBJECT = new Set(['y', 'o', 'también', 'tampoco', 'mismo', 'misma', 'solo', 'sola'])

function words(text: string): string[] {
  return [...(text.toLowerCase().match(WORD_RE) ?? [])]
}

function dropOptionalSpanish(t: string[]): string[] {
  const out = [...t]
  if (out.length >= 3 && ES_EMPHATIC.get(`${out[0]} ${out[1]}`) === out[2]) out.splice(0, 2)
  // Leading subject pronoun before a verb. "él" with accent only (never the article "el"); "tú" never "tu".
  if (out.length >= 2 && ES_SUBJECTS.has(out[0]!) && !ES_NOT_AFTER_SUBJECT.has(out[1]!)) out.shift()
  // Subject pronoun right after "no" or a leading object pronoun is rarer; leave it.
  void ES_OBJECT
  return out
}

function fold(text: string, eq: Equivalence, lang: 'es' | 'en'): Tok[] {
  let ws = words(text)
  if (lang === 'es') ws = dropOptionalSpanish(ws)
  const out: Tok[] = []
  for (let i = 0; i < ws.length; ) {
    let done = false
    for (let n = Math.min(eq.maxPhraseLen, ws.length - i); n >= 2; n--) {
      const k = ws.slice(i, i + n).join(' ')
      const g = eq.phrases.get(k) ?? eq.phrases.get(stripAccents(k))
      if (g) {
        out.push({ w: `«${k}»`, groups: new Set(g) })
        i += n
        done = true
        break
      }
    }
    if (done) continue
    const w = ws[i]!
    out.push({ w, groups: eq.words.get(w) ?? eq.words.get(stripAccents(w)) ?? new Set() })
    i++
  }
  return out
}

function sameTok(a: Tok, b: Tok, accentInsensitive: boolean): boolean {
  if (a.w === b.w) return true
  if (accentInsensitive && stripAccents(a.w) === stripAccents(b.w)) return true
  for (const g of a.groups) if (b.groups.has(g)) return true
  return false
}

/** Canonical display of the folded tokens (for debugging and tests). */
export function canonicalize(text: string, eq: Equivalence, lang: 'es' | 'en' = 'es'): string {
  return fold(text, eq, lang).map((t) => t.w).join(' ')
}

/**
 * 'exact' when equivalent with accents respected, 'accents' when equivalent only
 * ignoring accents, otherwise false.
 */
export function compareEquivalent(given: string, expected: string, eq: Equivalence, lang: 'es' | 'en' = 'es'): 'exact' | 'accents' | false {
  const a = fold(given, eq, lang)
  const b = fold(expected, eq, lang)
  if (a.length !== b.length || a.length === 0) return false
  if (a.every((t, i) => sameTok(t, b[i]!, false))) return 'exact'
  if (a.every((t, i) => sameTok(t, b[i]!, true))) return 'accents'
  return false
}

export function equivalent(a: string, b: string, eq: Equivalence, lang: 'es' | 'en' = 'es'): boolean {
  return compareEquivalent(a, b, eq, lang) !== false
}

/**
 * Expand accepted answers that contain optional text in brackets or slashes:
 * "to be (very) tired" → with and without "very"; "he/she is" → "he is", "she is".
 */
export function expandAnswers(answers: string[]): string[] {
  const out = new Set<string>()
  const add = (s: string) => {
    const t = s.replace(/\s+/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim()
    if (t) out.add(t)
  }
  for (const a of answers) {
    add(a)
    if (/[([]/.test(a)) {
      add(a.replace(/\s*[([][^)\]]*[)\]]\s*/g, ' '))
      add(a.replace(/[()[\]]/g, ''))
    }
    const slash = a.match(/(\p{L}+)\s*\/\s*(\p{L}+)/u)
    if (slash) {
      add(a.replace(slash[0], slash[1]!))
      add(a.replace(slash[0], slash[2]!))
    }
  }
  return [...out]
}

/**
 * Lenient typo check, word by word: each differing word must be within one edit
 * (two for words of 8+ letters) and — when a dictionary predicate is given — must
 * not itself be a real word, so "gusta" for "gustan" stays wrong while "gustann"
 * or "guston" passes. At most one typo per four words (minimum one).
 */
export function typoMatch(given: string, expected: string, isWord?: (w: string) => boolean, minLen = 4): { ok: boolean; fixes: [string, string][] } {
  const gw = words(given)
  const ew = words(expected)
  if (gw.length !== ew.length || !gw.length) return { ok: false, fixes: [] }
  const budget = Math.max(1, Math.floor(gw.length / 4))
  const fixes: [string, string][] = []
  for (let i = 0; i < gw.length; i++) {
    const a = stripAccents(gw[i]!)
    const b = stripAccents(ew[i]!)
    if (a === b) continue
    if (b.length < minLen) return { ok: false, fixes: [] }
    const d = editDistance(a, b)
    if (d > (b.length >= 8 ? 2 : 1)) return { ok: false, fixes: [] }
    if (isWord && isWord(gw[i]!)) return { ok: false, fixes: [] }
    fixes.push([gw[i]!, ew[i]!])
    if (fixes.length > budget) return { ok: false, fixes: [] }
  }
  return { ok: fixes.length > 0, fixes }
}

/** Damerau–Levenshtein distance (adjacent transposition counts as one edit). */
export function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1)
      d[i]![j] = v
    }
  }
  return d[m]![n]!
}
