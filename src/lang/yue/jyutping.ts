/**
 * Jyutping (LSHK romanisation of Cantonese): syllable inventory, parsing of
 * learner input with or without spaces and tone numbers, tone stripping.
 */
import charsData from './data/chars.json'

const CHARS = charsData as Record<string, string[]>

/** Every toneless syllable that occurs in the character table (aa, baak, ngo, m, ng…). */
export const SYLLABLES: ReadonlySet<string> = (() => {
  const s = new Set<string>(['m', 'ng'])
  for (const list of Object.values(CHARS)) for (const r of list) s.add(r.replace(/[1-6]$/, ''))
  return s
})()

const MAX_SYL = 6

export const stripTone = (syl: string): string => syl.replace(/([a-z])[1-6]$/, '$1')
/** Remove tone numbers from every syllable of a Jyutping string. */
export const stripTones = (s: string): string => s.replace(/([a-z])[1-6](?=$|[^0-9])/g, '$1')

/**
 * Split a Latin-letter run into Jyutping syllables, keeping tone numbers.
 * Accepts "nei5hou2", "nei5 hou2", "neihou". Returns undefined when the run is not Jyutping
 * (English words in mixed sentences stay as they are).
 */
export function parseRun(run: string): string[] | undefined {
  const s = run.toLowerCase()
  const n = s.length
  // best[i] = fewest syllables covering s[0..i)
  const best: (string[] | undefined)[] = new Array(n + 1).fill(undefined)
  best[0] = []
  for (let i = 0; i < n; i++) {
    const cur = best[i]
    if (!cur) continue
    for (let len = Math.min(MAX_SYL, n - i); len >= 1; len--) {
      const base = s.slice(i, i + len)
      if (!SYLLABLES.has(base)) continue
      let end = i + len
      let syl = base
      if (end < n && /[1-6]/.test(s[end]!)) {
        syl += s[end]
        end++
      }
      const cand = [...cur, syl]
      if (!best[end] || best[end]!.length > cand.length) best[end] = cand
    }
  }
  return best[n]
}

/** True when a text is written in Jyutping (letters with tone digits), not characters. */
export function looksLikeJyutping(text: string): boolean {
  return /[a-z]/i.test(text) && !/\p{Script=Han}/u.test(text)
}

/** Readings of a single character, most common first. */
export function charReadings(c: string): string[] | undefined {
  return CHARS[c]
}
