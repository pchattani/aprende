import type { AnswerMatch } from '../types'

const PUNCT = /[.,;:!?¿¡"“”«»'’()[\]{}…\-–—/\\]+/g

/** Remove accents from vowels (and ü) but keep ñ distinct (año ≠ ano). */
export function stripAccents(s: string): string {
  const N = String.fromCharCode(1)
  const NN = String.fromCharCode(2)
  return s
    .split('ñ').join(N)
    .split('Ñ').join(NN)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .split(N).join('ñ')
    .split(NN).join('Ñ')
}

export function normalize(text: string, opts: { accentInsensitive?: boolean } = {}): string {
  let s = text.normalize('NFC').toLowerCase().replace(PUNCT, ' ').replace(/\s+/g, ' ').trim()
  if (opts.accentInsensitive) s = stripAccents(s)
  return s
}

/** Damerau–Levenshtein (optimal string alignment) distance. */
export function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i]![0] = i
  for (let j = 0; j <= n; j++) d[0]![j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2]![j - 2]! + 1)
      }
      d[i]![j] = v
    }
  }
  return d[m]![n]!
}

/**
 * Compare a learner answer with the accepted answers.
 * - exact after normalization -> correct
 * - equal ignoring accents -> almost (accent note)
 * - one typo in a word of 5+ letters, no accent-only word changed -> almost (typo note)
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
      return { verdict: 'almost', matched: e, notes: diffs.map((d) => `Watch the accent: “${d.given}” should be “${d.expected}”.`) }
    }
  }
  // Single typo tolerance: compare word by word.
  let best: { e: string; notes: string[] } | undefined
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
      const finalOnly = a.slice(0, -1) === b.slice(0, -1) || a === b.slice(0, -1) || b === a.slice(0, -1)
      if (dist === 1 && b.length >= 5 && !finalOnly) {
        typos++
        notes.push(`Small typo: “${g.split(' ')[i]}” → “${en.split(' ')[i]}”.`)
      } else {
        ok = false
        break
      }
    }
    if (ok && typos === 1) {
      best = { e, notes }
      break
    }
  }
  if (best) return { verdict: 'almost', matched: best.e, notes: best.notes }
  return { verdict: 'wrong', notes: [] }
}

function accentDiffs(given: string, expected: string): { given: string; expected: string }[] {
  const gw = given.split(' ')
  const ew = expected.split(' ')
  const out: { given: string; expected: string }[] = []
  for (let i = 0; i < Math.min(gw.length, ew.length); i++) {
    if (gw[i] !== ew[i]) out.push({ given: gw[i]!, expected: ew[i]! })
  }
  return out
}

/** Words of a sentence suitable for tiles (keeps accents, drops punctuation). */
export function words(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean)
}
