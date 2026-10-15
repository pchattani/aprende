/**
 * Cantonese answer comparison. Learners may type characters or Jyutping (with or
 * without spaces); both sides become toned Jyutping syllables and are compared:
 * equal → correct; equal without tones → 'almost' (reason 'accents' = tones);
 * one syllable off by one letter in a long answer → 'almost' (typo).
 */
import type { AnswerMatch } from '../types'
import { toSyllables, wordsOf } from './lexicon'
import { stripTone, stripTones } from './jyutping'

export { editDistance } from '../distance'
import { editDistance } from '../distance'

/** Tones are what Cantonese learners drop; this is the counterpart of stripping accents. */
export function stripAccents(s: string): string {
  return stripTones(s)
}

export function normalize(text: string, opts: { accentInsensitive?: boolean } = {}): string {
  const syl = toSyllables(text)
  return (opts.accentInsensitive ? syl.map(stripTone) : syl).join(' ')
}

const HAN = /\p{Script=Han}/u
const charsOnly = (s: string) => [...s].filter((c) => HAN.test(c)).join('')

/** Jyutping spellings of the same sound (呢 ni1 / nei1) compare equal. */
const canon = (syl: string[]) => syl.map((x) => x.replace(/^ni(?=[1-6]?$)/, 'nei'))

export function match(given: string, expected: string[]): AnswerMatch {
  const g = canon(toSyllables(given))
  if (!g.length) return { verdict: 'wrong', notes: [] }
  for (const e of expected) {
    const es = canon(toSyllables(e))
    if (es.join(' ') === g.join(' ')) {
      // Same sounds; if typed in characters, mention a different character choice.
      const gc = charsOnly(given)
      const ec = charsOnly(e)
      const notes = gc && ec && gc !== ec ? [`Same sounds; the usual characters are “${ec}”.`] : []
      return { verdict: 'correct', matched: e, notes }
    }
  }
  for (const e of expected) {
    const es = canon(toSyllables(e))
    if (es.length === g.length && es.every((x, i) => stripTone(x) === stripTone(g[i]!))) {
      const diffs = es.filter((x, i) => x !== g[i]).slice(0, 4)
      return { verdict: 'almost', matched: e, reason: 'accents', notes: [`Watch the tones: ${diffs.map((d) => `“${d}”`).join(', ')}.`] }
    }
  }
  // One small typo in a syllable of 4+ letters, in answers of three or more syllables.
  for (const e of expected) {
    const es = canon(toSyllables(e))
    if (es.length !== g.length || es.length < 3) continue
    let typos = 0
    let note = ''
    let ok = true
    for (let i = 0; i < es.length; i++) {
      const a = stripTone(g[i]!)
      const b = stripTone(es[i]!)
      if (a === b) continue
      if (b.length >= 4 && editDistance(a, b) === 1) {
        typos++
        note = `Small typo: “${g[i]}” → “${es[i]}”.`
      } else {
        ok = false
        break
      }
    }
    if (ok && typos === 1) return { verdict: 'almost', matched: e, reason: 'typo', notes: [note] }
  }
  return { verdict: 'wrong', notes: [] }
}

/** Words of a sentence suitable for tiles. */
export function words(text: string): string[] {
  return wordsOf(text)
}
