/**
 * Pure helpers for the "Palabras" vocabulary games: which words to play with,
 * a memory board of Spanish/English pairs, and a quick-fire round.
 */
import type { CardRow } from './types'
import type { VocabEntry } from './schema'
import { Rng } from './random'
import { distractorWords, type GenContext } from './generate'

/** Words worth playing: due first, then the least stable, then the lowest stage. Samples from the top so sessions vary. */
export function pickGameWords(cards: CardRow[], lookup: (id: string) => VocabEntry | undefined, n: number, rng: Rng, now = Date.now()): VocabEntry[] {
  const words = cards.filter((c) => c.kind === 'word' && lookup(c.id)?.en[0])
  const ranked = [...words].sort((a, b) => Number(b.due <= now) - Number(a.due <= now) || a.stability - b.stability || a.stage - b.stage)
  // every due word first (shuffled), then a sample of the weakest of the rest
  const due = ranked.filter((c) => c.due <= now)
  const rest = ranked.filter((c) => c.due > now).slice(0, n * 2)
  const picked: VocabEntry[] = []
  const glosses = new Set<string>()
  for (const c of [...rng.shuffle(due), ...rng.shuffle(rest)]) {
    const v = lookup(c.id)!
    const g = v.en[0]!.toLowerCase()
    if (glosses.has(g)) continue
    glosses.add(g)
    picked.push(v)
    if (picked.length >= n) break
  }
  return picked
}

export interface MemoryTile {
  /** Pair key (the vocab id). */
  key: string
  text: string
  side: 'es' | 'en'
}
/** 16 tiles: 8 Spanish/English pairs, shuffled. */
export function memoryBoard(words: VocabEntry[], rng: Rng, pairs = 8): MemoryTile[] {
  const tiles: MemoryTile[] = []
  for (const v of words.slice(0, pairs)) {
    tiles.push({ key: v.id, text: v.lemma, side: 'es' })
    tiles.push({ key: v.id, text: v.en[0]!, side: 'en' })
  }
  return rng.shuffle(tiles)
}

export interface RapidQuestion {
  v: VocabEntry
  options: string[]
  answer: number
}
/** Quick-fire questions: Spanish word, four English options. */
export function rapidRound(words: VocabEntry[], ctx: GenContext, rng: Rng): RapidQuestion[] {
  const out: RapidQuestion[] = []
  for (const v of words) {
    const ds = distractorWords(v, ctx, rng, 3)
    if (ds.length < 3) continue
    const options = rng.shuffle([v.en[0]!, ...ds.map((d) => d.en[0]!)])
    out.push({ v, options, answer: options.indexOf(v.en[0]!) })
  }
  return out
}

/** Score for a quick-fire answer: 10 points, times a streak multiplier (max ×4). */
export function rapidPoints(streak: number): number {
  return 10 * Math.min(4, 1 + Math.floor(streak / 3))
}

/**
 * The letters of a word in a crossword grid, one per cell: the lemma as the language pack
 * normalizes it (lowercase, accents kept, ligatures spelled out), or for Cantonese the
 * Jyutping without tone numbers. Undefined for multi-word lemmas, elisions, hyphenated
 * words and anything shorter than 3 or longer than 10 cells.
 */
export function crosswordLetters(v: VocabEntry, normalize: (s: string) => string): string[] | undefined {
  const raw = v.jp ? v.jp.split(' ').map((s) => s.replace(/[1-6]$/, '')).join('') : normalize(v.lemma)
  const letters = [...raw.normalize('NFC')]
  if (letters.length < 3 || letters.length > 10 || !letters.every((ch) => /^\p{L}$/u.test(ch))) return undefined
  return letters
}

/**
 * A lookup for pickGameWords that only returns words that fit a crossword and whose clue
 * does not give the answer away (hotel = "hotel").
 */
export function crosswordLookup(lookup: (id: string) => VocabEntry | undefined, pack: { normalize: (s: string) => string; stripMarks: (s: string) => string }): (id: string) => VocabEntry | undefined {
  return (id) => {
    const v = lookup(id)
    if (!v?.en[0]) return undefined
    const letters = crosswordLetters(v, pack.normalize)
    if (!letters) return undefined
    const answer = pack.stripMarks(letters.join(''))
    const clue = pack.stripMarks(v.en[0].toLowerCase().replace(/^to /, '').replace(/[^\p{L}]/gu, ''))
    return answer === clue ? undefined : v
  }
}

/**
 * Boards for "match the sound": `boards` groups of `size` words, no two words in a
 * board that sound alike (same `soundKey`), each word used once. Short boards are dropped.
 */
export function soundBoards(words: VocabEntry[], rng: Rng, soundKey: (v: VocabEntry) => string, size = 4, boards = 3): VocabEntry[][] {
  const out: VocabEntry[][] = []
  const left = [...words]
  while (out.length < boards && left.length >= size) {
    const board: VocabEntry[] = []
    const keys = new Set<string>()
    for (let i = 0; i < left.length && board.length < size; ) {
      const k = soundKey(left[i]!)
      if (keys.has(k)) {
        i++
        continue
      }
      keys.add(k)
      board.push(left.splice(i, 1)[0]!)
    }
    if (board.length < size) break
    out.push(rng.shuffle(board))
  }
  return out
}
