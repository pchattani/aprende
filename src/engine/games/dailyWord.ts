/**
 * Word of the day: a Wordle-style puzzle with one hidden word a day. Pure logic: the letters
 * of a word (accents stripped; Jyutping without tones for Cantonese), the day's pick (seeded
 * by the date), tile marks with correct duplicate-letter handling, keyboard states, streaks
 * and the countdown to tomorrow.
 */
import type { VocabEntry } from '../schema'
import { hashString } from '../random'

export const DAILY_MIN = 4
export const DAILY_MAX = 7
export const DAILY_GUESSES = 6

/** hit = right letter, right place; near = in the word elsewhere; miss = not (or no more) in the word. */
export type Mark = 'hit' | 'near' | 'miss'

export interface FoldPack {
  normalize: (s: string) => string
  stripMarks: (s: string) => string
}

/** One spelling (a lemma or an inflected form) as guessable letters, or undefined if it has non-letters. */
export function foldWord(text: string, pack: FoldPack, jyutping = false): string | undefined {
  let raw: string
  if (jyutping) {
    // Jyutping syllables, with or without tone numbers: sik6 faan6 → sikfaan
    if (!/^[a-z]+[1-6]?( [a-z]+[1-6]?)*$/.test(text.trim())) return undefined
    raw = text.trim().replace(/[1-6]/g, '').replace(/ /g, '')
  } else raw = pack.stripMarks(pack.normalize(text))
  raw = raw.normalize('NFC')
  return /^\p{L}+$/u.test(raw) ? raw : undefined
}

/** The letters of a vocab entry for the puzzle (its Jyutping for Cantonese), when they are 4–7 letters long. */
export function dailyLetters(v: VocabEntry, pack: FoldPack): string[] | undefined {
  const w = v.jp ? foldWord(v.jp, pack, true) : foldWord(v.lemma, pack)
  if (!w) return undefined
  const letters = [...w]
  return letters.length >= DAILY_MIN && letters.length <= DAILY_MAX ? letters : undefined
}

/**
 * The words that may be guessed, by length: every course spelling (lemmas and the
 * dictionary's inflected forms) folded the same way as the answer.
 */
export function guessList(forms: Iterable<string>, pack: FoldPack, jyutping = false): Map<number, Set<string>> {
  const out = new Map<number, Set<string>>()
  for (const f of forms) {
    const w = foldWord(f, pack, jyutping)
    if (!w) continue
    const n = [...w].length
    if (n < DAILY_MIN || n > DAILY_MAX) continue
    if (!out.has(n)) out.set(n, new Set())
    out.get(n)!.add(w)
  }
  return out
}

/**
 * The day's word: a deterministic pick from `ids` (sorted, so the order they arrive in does
 * not matter) seeded by the day and `salt` (the course). Words in `recent` are skipped while
 * others remain, so the same word does not come back within a few weeks.
 */
/** The words the puzzle can hide: finished words (engine/finished.ts) with a meaning and 4–7 letters. Never anything else. */
export function dailyCandidates(finished: Iterable<VocabEntry>, pack: FoldPack): VocabEntry[] {
  return [...finished].filter((v) => v.en[0] && dailyLetters(v, pack))
}

export function wordOfDay(ids: readonly string[], day: string, salt = '', recent: readonly string[] = []): string | undefined {
  const sorted = [...new Set(ids)].sort()
  if (!sorted.length) return undefined
  const avoid = new Set(recent)
  const fresh = sorted.filter((id) => !avoid.has(id))
  const from = fresh.length ? fresh : sorted
  return from[hashString(`${salt}:${day}`) % from.length]
}

/**
 * Marks for a guess (both arrays of single letters, same length). Exact matches first; then
 * each remaining letter is `near` only while the answer still has an unmatched copy of it,
 * so a doubled letter in the guess never claims more than the answer holds.
 */
export function scoreGuess(guess: readonly string[], answer: readonly string[]): Mark[] {
  const marks: Mark[] = guess.map(() => 'miss')
  const spare = new Map<string, number>()
  guess.forEach((g, i) => {
    if (g === answer[i]) marks[i] = 'hit'
    else if (answer[i] !== undefined) spare.set(answer[i]!, (spare.get(answer[i]!) ?? 0) + 1)
  })
  guess.forEach((g, i) => {
    if (marks[i] === 'hit') return
    const n = spare.get(g) ?? 0
    if (n > 0) {
      marks[i] = 'near'
      spare.set(g, n - 1)
    }
  })
  return marks
}

const RANK: Record<Mark, number> = { miss: 0, near: 1, hit: 2 }
/** Best mark seen for each letter, for the on-screen keyboard. */
export function keyStates(rows: readonly { guess: readonly string[]; marks: readonly Mark[] }[]): Map<string, Mark> {
  const out = new Map<string, Mark>()
  for (const r of rows) {
    r.guess.forEach((g, i) => {
      const m = r.marks[i]!
      const prev = out.get(g)
      if (!prev || RANK[m] > RANK[prev]) out.set(g, m)
    })
  }
  return out
}

/** YYYY-MM-DD of the day before (calendar arithmetic, no time zones involved). */
export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(y, m - 1, d - 1))
  return t.toISOString().slice(0, 10)
}

/** The streak after finishing today's puzzle: one more after a win yesterday, back to 1 after a gap, 0 after a loss. */
export function nextStreak(prev: { day?: string; streak?: number }, today: string, won: boolean): number {
  if (!won) return 0
  if (prev.day === today) return Math.max(1, prev.streak ?? 0)
  return prev.day === previousDay(today) && (prev.streak ?? 0) > 0 ? (prev.streak ?? 0) + 1 : 1
}

/** The streak to show today: it still stands if the last puzzle was today or yesterday. */
export function liveStreak(prev: { day?: string; streak?: number }, today: string): number {
  return prev.day === today || prev.day === previousDay(today) ? (prev.streak ?? 0) : 0
}

/** Milliseconds until local midnight. */
export function msToTomorrow(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return Math.max(0, next.getTime() - now.getTime())
}

/** 3:07:45 */
export function formatCountdown(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
