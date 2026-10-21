/**
 * Scramble: a word's tiles (letters, or characters for Cantonese) shuffled into a pool; the learner
 * taps them back into slots. Short Cantonese words get decoy characters in the pool too, so two
 * characters are not a simple swap. Pure state so the page stays thin and the rules are testable.
 */
import { Rng } from '../random'

export const SCRAMBLE_SECONDS = 75
export const HINT_COST = 5

/**
 * A shuffled order of the tile indices whose letters never spell the answer as it stands
 * (repeated letters count: swapping the two s of "casas" is no scramble). Undefined when every
 * tile is the same, so no order differs.
 */
export function scrambleOrder(tiles: readonly string[], rng: Rng): number[] | undefined {
  if (tiles.length < 2 || tiles.every((t) => t === tiles[0])) return undefined
  const word = tiles.join('\u0000')
  const idx = tiles.map((_, i) => i)
  const spells = (order: number[]) => order.map((i) => tiles[i]).join('\u0000') === word
  for (let attempt = 0; attempt < 12; attempt++) {
    const order = rng.shuffle(idx)
    if (!spells(order)) return order
  }
  // a rotation by one only spells the word again when every tile is the same, ruled out above
  return [...idx.slice(1), idx[0]!]
}

/** Decoy characters for a Cantonese word: two for a two-character word, one for three, none for longer. */
export const decoyCount = (tiles: number) => (tiles === 2 ? 2 : tiles === 3 ? 1 : 0)

/**
 * Pick up to `count` decoys from `candidates` (the learner's other characters): never a tile of
 * the answer, no repeats, and never one that lets the tiles spell another accepted answer
 * (`isAnswer`, e.g. a synonym with the same meaning). Every arrangement of answer tiles plus
 * decoys that uses a decoy is checked.
 */
export function pickDecoys(answer: readonly string[], candidates: readonly string[], count: number, rng: Rng, isAnswer: (word: string) => boolean = () => false): string[] {
  const out: string[] = []
  for (const c of rng.shuffle([...new Set(candidates)])) {
    if (out.length >= count) break
    if (answer.includes(c)) continue
    const tiles = [...answer, ...out, c]
    if (arrangements(tiles, answer.length).some((w) => w.some((t) => !answer.includes(t)) && isAnswer(w.join('')))) continue
    out.push(c)
  }
  return out
}

/** Every ordered pick of `n` tiles (by position, so repeated tiles count once each). */
function arrangements(tiles: readonly string[], n: number): string[][] {
  if (n === 0) return [[]]
  return tiles.flatMap((t, i) => arrangements([...tiles.slice(0, i), ...tiles.slice(i + 1)], n - 1).map((rest) => [t, ...rest]))
}

export interface ScrambleState {
  /** The answer's tiles in order. */
  tiles: string[]
  /** Extra tiles that belong nowhere (indices tiles.length…); they stay in the tray. */
  decoys: string[]
  /** Tile indices (answer tiles, then decoys) in the order the pool shows them. */
  pool: number[]
  /** Which tile sits in each slot (null = empty). */
  slots: (number | null)[]
  /** Slots filled by a hint: they stay put. */
  locked: boolean[]
  hints: number
  /** Full but wrong attempts. */
  misses: number
}

/** Decoys are mixed in among the scrambled answer tiles, which never read in order. */
export function newScramble(tiles: string[], rng: Rng, decoys: string[] = []): ScrambleState | undefined {
  let pool = scrambleOrder(tiles, rng)
  if (!pool) return undefined
  for (let d = 0; d < decoys.length; d++) {
    const at = rng.int(pool.length + 1)
    pool = [...pool.slice(0, at), tiles.length + d, ...pool.slice(at)]
  }
  return { tiles, decoys, pool, slots: tiles.map(() => null), locked: tiles.map(() => false), hints: 0, misses: 0 }
}

/** What a tile shows (answer tile or decoy). */
export const tileText = (s: ScrambleState, tile: number) => (tile < s.tiles.length ? s.tiles[tile]! : s.decoys[tile - s.tiles.length]!)
export const isPlaced = (s: ScrambleState, tile: number) => s.slots.includes(tile)
export const isFull = (s: ScrambleState) => s.slots.every((t) => t !== null)
/** Right when the slots spell the answer (tiles with the same letter are interchangeable; a decoy never fits). */
export const isSolved = (s: ScrambleState) => isFull(s) && s.slots.every((t, i) => tileText(s, t!) === s.tiles[i])

/** Put a pool tile into the first empty slot. */
export function place(s: ScrambleState, tile: number): ScrambleState {
  const at = s.slots.indexOf(null)
  if (at < 0 || isPlaced(s, tile) || tile < 0 || tile >= s.tiles.length + s.decoys.length) return s
  const slots = [...s.slots]
  slots[at] = tile
  return { ...s, slots }
}

/** Send a slot's tile back to the pool (hinted slots stay). */
export function unplace(s: ScrambleState, slot: number): ScrambleState {
  if (s.locked[slot] || s.slots[slot] === null || s.slots[slot] === undefined) return s
  const slots = [...s.slots]
  slots[slot] = null
  return { ...s, slots }
}

/** The last tile placed that may come back (for Backspace). */
export function unplaceLast(s: ScrambleState): ScrambleState {
  for (let i = s.slots.length - 1; i >= 0; i--) if (s.slots[i] !== null && !s.locked[i]) return unplace(s, i)
  return s
}

/** Place the first unplaced tile showing `letter` (typed on a keyboard), compared with `same`. */
export function placeLetter(s: ScrambleState, letter: string, same: (a: string, b: string) => boolean = (a, b) => a === b): ScrambleState {
  const tile = s.pool.find((t) => !isPlaced(s, t) && same(tileText(s, t), letter))
  return tile === undefined ? s : place(s, tile)
}

/** Empty every slot a hint did not fill (after a wrong attempt). */
export function clearSlots(s: ScrambleState, miss = false): ScrambleState {
  return { ...s, slots: s.slots.map((t, i) => (s.locked[i] ? t : null)), misses: s.misses + (miss ? 1 : 0) }
}

export function reshuffle(s: ScrambleState, rng: Rng): ScrambleState {
  return { ...s, pool: rng.shuffle(s.pool) }
}

/**
 * Reveal the next letter: the first slot a hint has not fixed gets the right tile and is locked.
 * A slot already holding the right tile is locked on the way, so each hint shows one new letter.
 */
export function hint(s: ScrambleState): ScrambleState {
  const slots = [...s.slots]
  const locked = [...s.locked]
  for (let i = 0; i < s.tiles.length; i++) {
    if (locked[i]) continue
    const cur = slots[i]
    if (cur !== null && cur !== undefined && tileText(s, cur) === s.tiles[i]) {
      locked[i] = true
      continue
    }
    // the right tile: one not yet locked elsewhere, preferring one still in the pool
    const free = s.pool.filter((t) => tileText(s, t) === s.tiles[i] && !slots.some((x, j) => x === t && locked[j]))
    const tile = free.find((t) => !slots.includes(t)) ?? free[0]
    if (tile === undefined) return s
    const was = slots.indexOf(tile)
    if (was >= 0) slots[was] = null
    slots[i] = tile
    locked[i] = true
    return { ...s, slots, locked, hints: s.hints + 1 }
  }
  return s
}

/** ×1 to ×4: one step up for every three words in a row. */
export const scrambleMultiplier = (streak: number) => Math.min(4, 1 + Math.floor(streak / 3))

/** Points for a solved word: 10 plus 2 a tile, less 5 a hint (never below 2), times the streak multiplier. */
export function scramblePoints(tiles: number, hints: number, streak: number): number {
  return Math.max(2, 10 + 2 * tiles - HINT_COST * hints) * scrambleMultiplier(streak)
}

/** How the word counts as a review. */
export function scrambleVerdict(s: ScrambleState, skipped = false): 'correct' | 'almost' | 'wrong' {
  if (skipped || !isSolved(s)) return 'wrong'
  return s.hints === 0 && s.misses === 0 ? 'correct' : s.hints * 2 >= s.tiles.length ? 'wrong' : 'almost'
}
