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
