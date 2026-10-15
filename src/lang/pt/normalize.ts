import type { AnswerMatch } from '../types'
export { editDistance } from '../distance'
import { editDistance } from '../distance'

/** Punctuation removed by normalize(). Hyphens and apostrophes inside a word (dá-me, guarda-chuva, d'água) are kept. */
const PUNCT = /[.,;:!?¿¡"“”«»()[\]{}…–—/\\]+/g
/** A hyphen or apostrophe that is not between two letters. */
const LOOSE_JOINER = /(?<!\p{L})['’-]|['’-](?!\p{L})/gu

/**
 * Remove the marks Portuguese learners commonly omit: acute, grave, circumflex,
 * tilde, diaeresis and the cedilla (começo → comeco, não → nao).
 */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC')
}

export function normalize(text: string, opts: { accentInsensitive?: boolean } = {}): string {
  let s = text
    .normalize('NFC')
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(PUNCT, ' ')
    .replace(LOOSE_JOINER, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (opts.accentInsensitive) s = stripAccents(s)
  return s
}

/**
 * Compare a learner answer with the accepted answers.
 * - exact after normalization -> correct
 * - equal ignoring accents and cedilla -> almost (reason 'accents')
 * - one typo in a word of 5+ letters -> almost (reason 'typo')
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
      return { verdict: 'almost', matched: e, reason: 'accents', notes: diffs.map((d) => markNote(d.given, d.expected)) }
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
      // A change in the last letter is usually grammar (bonito/bonita, falo/fala), not a typo.
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

function markNote(given: string, expected: string): string {
  const cedilla = expected.includes('ç') && !given.includes('ç')
  const accent = stripAccents(expected) !== expected.replace(/ç/g, 'c')
  if (cedilla && !accent) return `Watch the cedilla: “${given}” should be “${expected}”.`
  return `Watch the accent: “${given}” should be “${expected}”.`
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

/** Words of a sentence suitable for tiles (keeps accents and hyphenated forms like “dá-me”, drops punctuation). */
export function words(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean)
}
