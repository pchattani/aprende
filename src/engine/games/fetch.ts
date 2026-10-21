/**
 * Fetch!: a dog-friendly hangman. The answer is shown as letter slots; each guess is a base letter
 * (guessing "a" also reveals á and à), and every miss rolls Leo's ball one step further away.
 * Six misses and the ball is gone.
 */

/** Steps on the path between Leo and the bushes: misses allowed before the ball is lost. */
export const FETCH_STEPS = 6
export const FETCH_ROUND = 5

export interface FetchState {
  /** The answer as written (accents kept), one entry per character, spaces and apostrophes included. */
  chars: string[]
  /** The base letter each character is guessed by (`null` for spaces and punctuation, always shown). */
  keys: (string | null)[]
  /** Base letters tried so far, in order. */
  guessed: string[]
  misses: number
}

/**
 * The base letter of a character, using the course's fold (accents off, lowercase). Letters the
 * fold turns into two (a ligature) keep themselves.
 */
export function fetchKey(ch: string, fold: (s: string) => string): string | null {
  if (!/^\p{L}$/u.test(ch)) return null
  const k = fold(ch.toLowerCase())
  return [...k].length === 1 ? k : ch.toLowerCase()
}

export function newFetch(answer: string, fold: (s: string) => string): FetchState {
  const chars = [...answer.normalize('NFC')]
  return { chars, keys: chars.map((ch) => fetchKey(ch, fold)), guessed: [], misses: 0 }
}

export const isWon = (s: FetchState) => s.keys.every((k) => k === null || s.guessed.includes(k))
export const isLost = (s: FetchState) => !isWon(s) && s.misses >= FETCH_STEPS
export const isOver = (s: FetchState) => isWon(s) || isLost(s)

/** Which characters are showing. */
export const shown = (s: FetchState) => s.keys.map((k) => k === null || s.guessed.includes(k))

/** Guess a base letter. Repeats and guesses after the word is over change nothing. */
export function guess(s: FetchState, key: string): FetchState {
  const k = key.toLowerCase()
  if (isOver(s) || s.guessed.includes(k)) return s
  const hit = s.keys.includes(k)
  return { ...s, guessed: [...s.guessed, k], misses: s.misses + (hit ? 0 : 1) }
}

/** How many characters a guess uncovered (0 for a miss). */
export const hits = (s: FetchState, key: string) => s.keys.filter((k) => k === key).length

/** Misses left before the ball is gone. */
export const spared = (s: FetchState) => Math.max(0, FETCH_STEPS - s.misses)

/** Points for a finished word: 10 for the fetch, 2 for each step the ball never rolled. */
export const fetchPoints = (s: FetchState) => (isWon(s) ? 10 + 2 * spared(s) : 0)

/** How the word counts as a review: clean or nearly clean wins are right, a scrappy win is close, a lost ball is wrong. */
export function fetchVerdict(s: FetchState): 'correct' | 'almost' | 'wrong' {
  if (!isWon(s)) return 'wrong'
  return s.misses <= 2 ? 'correct' : 'almost'
}

/**
 * The on-screen keyboard: QWERTY rows of a–z, plus the course's own letters that guessing a base
 * letter does not cover (ñ in Spanish; ç folds to c in French, so it needs no key).
 */
export function fetchKeyboard(fold: (s: string) => string, extras: readonly string[] = ['ñ']): string[][] {
  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((r) => [...r])
  const own = extras.filter((ch) => fold(ch) === ch)
  if (own.length) rows[1]!.push(...own)
  return rows
}
