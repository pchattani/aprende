import type { AnswerMatch } from '../types'
import { editDistance } from '../distance'

export { editDistance }

/** Punctuation removed by normalize (the apostrophe is handled separately: it is part of l'amico, po', c'è). */
const PUNCT = /[.,;:!?¿¡"“”«»()[\]{}…\-–—/\\]+/g

/**
 * Words that really end in an apostrophe (truncations and the short imperatives):
 * "un po'", "va'", "fa'", "da'", "sta'", "di'". Any other final vowel + apostrophe is
 * a learner's way of typing an accent: "perche'" = perché, "citta'" = città.
 */
export const APOSTROPHE_WORDS: ReadonlySet<string> = new Set(["po'", "mo'", "va'", "fa'", "da'", "sta'", "di'", "to'", "be'", "ca'"])

const GRAVE: Record<string, string> = { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù' }

/** é for perché, poiché, né, sé, ventitré; è otherwise (è, caffè, cioè). */
function accentFor(word: string): string {
  const stem = word.slice(0, -1)
  const v = word.slice(-1)
  if (v === 'e' && (stem.endsWith('ch') || stem === 'n' || stem === 's' || (stem.endsWith('tr') && stem.length > 2))) return stem + 'é'
  return stem + (GRAVE[v] ?? v)
}

/**
 * Turn apostrophe-for-accent spellings into the accented word ("perche'" → "perché",
 * "citta'" → "città", "e'" → "è"). Real apostrophe words (po', va') and elisions (l')
 * are kept. Works on lowercase or mixed-case text; quotes ('ciao') are left alone.
 */
export function apostropheAccents(text: string): string {
  return text.replace(/(^|[^\p{L}'’])(\p{L}+)['’](?=$|[^\p{L}])/gu, (m, pre: string, word: string) => {
    const lw = word.toLowerCase()
    if (APOSTROPHE_WORDS.has(lw + "'")) return m
    if (pre === "'" || pre === '’') return m
    if (!/[aeiou]$/.test(lw)) return m
    const fixed = accentFor(lw)
    return pre + (word[0] !== lw[0] ? fixed[0]!.toUpperCase() + fixed.slice(1) : fixed)
  })
}

/** Remove accents (à è é ì ò ù, also í ó ú) and accent apostrophes ("perche'" → "perche"). */
export function stripAccents(s: string): string {
  return s
    .replace(/(^|[^\p{L}'’])(\p{L}+)['’](?=$|[^\p{L}])/gu, (m, pre: string, word: string) =>
      APOSTROPHE_WORDS.has(word.toLowerCase() + "'") || !/[aeiou]$/i.test(word) ? m : pre + word,
    )
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
}

/**
 * Lowercase, accent apostrophes → accents, elisions kept as one word ("l'amico",
 * also when typed "l' amico"), punctuation and quote marks dropped, spaces collapsed.
 */
export function normalize(text: string, opts: { accentInsensitive?: boolean } = {}): string {
  let s = text.normalize('NFC').toLowerCase().replace(/[’‘`´]/g, "'")
  s = apostropheAccents(s)
  // l' amico → l'amico (an elided word ends in a consonant + apostrophe)
  s = s.replace(/([bcdfghjklmnpqrstvwxyz])'\s+(?=\p{L})/gu, "$1'")
  // apostrophes that are quote marks: not after a letter, or closing a quoted word
  s = s.replace(/(^|[^\p{L}])'+/gu, '$1 ')
  s = s.replace(/(\p{L}+)'(?=$|[^\p{L}])/gu, (m, w: string) => (APOSTROPHE_WORDS.has(w + "'") || /[bcdfghjklmnpqrstvwxyz]$/.test(w) ? m : w))
  s = s.replace(PUNCT, ' ').replace(/\s+/g, ' ').trim()
  if (opts.accentInsensitive) s = stripAccents(s)
  return s
}

/**
 * Compare a learner answer with the accepted answers.
 * - exact after normalization -> correct
 * - equal ignoring accents -> almost (accent note)
 * - one typo in a word of 5+ letters, no ending-only change -> almost (typo note)
 */
export function match(given: string, expected: string[]): AnswerMatch {
  const g = normalize(given)
  if (!g) return { verdict: 'wrong', notes: [] }
  for (const e of expected) {
    if (normalize(e) === g) return { verdict: 'correct', matched: e, notes: [] }
  }
  const gNoAcc = stripAccents(g)
  for (const e of expected) {
    const en = normalize(e)
    if (stripAccents(en) === gNoAcc) {
      const diffs = accentDiffs(g, en)
      return { verdict: 'almost', matched: e, reason: 'accents', notes: diffs.map((d) => `Watch the accent: “${d.given}” should be “${d.expected}”.`) }
    }
  }
  // Single typo tolerance: compare word by word.
  for (const e of expected) {
    const en = normalize(e)
    const gw = gNoAcc.split(' ')
    const ew = stripAccents(en).split(' ')
    if (gw.length !== ew.length) continue
    let typos = 0
    const notes: string[] = []
    let ok = true
    for (let i = 0; i < gw.length; i++) {
      const a = gw[i]!
      const b = ew[i]!
      if (a === b) continue
      const dist = editDistance(a, b)
      // a different ending is grammar (rosso/rossa, parlo/parla), not a typo
      const finalOnly = a.slice(0, -1) === b.slice(0, -1) || a === b.slice(0, -1) || b === a.slice(0, -1)
      if (dist === 1 && b.length >= 5 && !finalOnly) {
        typos++
        notes.push(`Small typo: “${g.split(' ')[i]}” → “${en.split(' ')[i]}”.`)
      } else {
        ok = false
        break
      }
    }
    if (ok && typos === 1) return { verdict: 'almost', matched: e, reason: 'typo', notes }
  }
  return { verdict: 'wrong', notes: [] }
}

export function accentDiffs(given: string, expected: string): { given: string; expected: string }[] {
  const gw = given.split(' ')
  const ew = expected.split(' ')
  const out: { given: string; expected: string }[] = []
  for (let i = 0; i < Math.min(gw.length, ew.length); i++) {
    if (gw[i] !== ew[i]) out.push({ given: gw[i]!, expected: ew[i]! })
  }
  return out
}

/** Words of a sentence suitable for tiles (keeps accents and elisions: "l'amico" is one tile). */
export function words(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean)
}
