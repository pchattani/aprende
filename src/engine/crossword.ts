/**
 * A small, seeded crossword generator for the "Palabras" games. Pure and
 * deterministic: the same words and seed always give the same grid.
 *
 * Words are placed greedily (longest first, with a little seeded jitter), each
 * new word crossing at least one placed word, with the usual crossword rules:
 * a shared cell holds the same letter in both words, no two words run side by
 * side, and nothing touches the ends of a word. Several seeded attempts are
 * made and the fullest, most tightly crossed, most compact layout wins.
 */
import { Rng } from './random'

export type Dir = 'across' | 'down'

export interface CrosswordWord {
  id: string
  /** One letter per cell, exactly as shown when solved (lowercase, accents kept). */
  letters: string[]
  clue: string
}

export interface CrosswordEntry extends CrosswordWord {
  row: number
  col: number
  dir: Dir
  /** Clue number (shared by an across and a down word that start in the same cell). */
  number: number
}

export interface Crossword {
  width: number
  height: number
  /** Sorted by number, across before down. */
  entries: CrosswordEntry[]
  /** grid[row][col]: the solution letter, or null for a blank square. */
  grid: (string | null)[][]
}

export interface CrosswordOptions {
  /** Stop after placing this many words (default 9). */
  maxWords?: number
  /** Largest grid, in cells (default 11 × 11, which fits a phone). */
  maxWidth?: number
  maxHeight?: number
  /** Seeded layouts to try (default 24). */
  attempts?: number
}

/** The cells a word covers, in order. */
export function cellsOf(e: { row: number; col: number; dir: Dir; letters: readonly string[] }): [number, number][] {
  return e.letters.map((_, i) => (e.dir === 'across' ? [e.row, e.col + i] : [e.row + i, e.col]))
}

interface Cell {
  ch: string
  across: boolean
  down: boolean
}
interface Placed {
  w: CrosswordWord
  row: number
  col: number
  dir: Dir
}
interface Layout {
  placed: Placed[]
  crossings: number
  minR: number
  maxR: number
  minC: number
  maxC: number
}

const key = (r: number, c: number) => `${r},${c}`

class Board {
  cells = new Map<string, Cell>()
  placed: Placed[] = []
  crossings = 0
  minR = 0
  maxR = -1
  minC = 0
  maxC = -1
  readonly maxW: number
  readonly maxH: number
  constructor(maxW: number, maxH: number) {
    this.maxW = maxW
    this.maxH = maxH
  }

  /** Crossings made by placing `w` at (row, col, dir), or -1 when it does not fit. */
  fits(w: CrosswordWord, row: number, col: number, dir: Dir): number {
    const [dr, dc] = dir === 'across' ? [0, 1] : [1, 0]
    const n = w.letters.length
    if (this.cells.has(key(row - dr, col - dc)) || this.cells.has(key(row + dr * n, col + dc * n))) return -1
    const endR = row + dr * (n - 1)
    const endC = col + dc * (n - 1)
    if (this.placed.length) {
      if (Math.max(this.maxR, endR) - Math.min(this.minR, row) + 1 > this.maxH) return -1
      if (Math.max(this.maxC, endC) - Math.min(this.minC, col) + 1 > this.maxW) return -1
    }
    let crossings = 0
    for (let i = 0; i < n; i++) {
      const r = row + dr * i
      const c = col + dc * i
      const cell = this.cells.get(key(r, c))
      if (cell) {
        if (cell.ch !== w.letters[i] || cell[dir]) return -1
        crossings++
      } else if (this.cells.has(key(r + dc, c + dr)) || this.cells.has(key(r - dc, c - dr))) {
        // an empty square of the new word may not sit beside an existing letter (no side-by-side words)
        return -1
      }
    }
    return crossings
  }

  place(w: CrosswordWord, row: number, col: number, dir: Dir, crossings: number) {
    cellsOf({ row, col, dir, letters: w.letters }).forEach(([r, c], i) => {
      const k = key(r, c)
      const cell = this.cells.get(k) ?? { ch: w.letters[i]!, across: false, down: false }
      cell[dir] = true
      this.cells.set(k, cell)
    })
    const endR = dir === 'down' ? row + w.letters.length - 1 : row
    const endC = dir === 'across' ? col + w.letters.length - 1 : col
    if (!this.placed.length) {
      ;[this.minR, this.maxR, this.minC, this.maxC] = [row, endR, col, endC]
    } else {
      this.minR = Math.min(this.minR, row)
      this.maxR = Math.max(this.maxR, endR)
      this.minC = Math.min(this.minC, col)
      this.maxC = Math.max(this.maxC, endC)
    }
    this.placed.push({ w, row, col, dir })
    this.crossings += crossings
  }

  area(extraR = 0, extraC = 0): number {
    return (this.maxR - this.minR + 1 + extraR) * (this.maxC - this.minC + 1 + extraC)
  }

  /** The best crossing placement for `w`, or undefined. */
  bestSpot(w: CrosswordWord, rng: Rng): { row: number; col: number; dir: Dir; crossings: number } | undefined {
    let best: { row: number; col: number; dir: Dir; crossings: number; score: number } | undefined
    for (const [k, cell] of this.cells) {
      const [r, c] = k.split(',').map(Number) as [number, number]
      for (const dir of ['across', 'down'] as const) {
        if (cell[dir]) continue
        w.letters.forEach((ch, i) => {
          if (ch !== cell.ch) return
          const row = dir === 'down' ? r - i : r
          const col = dir === 'across' ? c - i : c
          const x = this.fits(w, row, col, dir)
          if (x < 1) return
          const endR = dir === 'down' ? row + w.letters.length - 1 : row
          const endC = dir === 'across' ? col + w.letters.length - 1 : col
          const grownArea = (Math.max(this.maxR, endR) - Math.min(this.minR, row) + 1) * (Math.max(this.maxC, endC) - Math.min(this.minC, col) + 1)
          // more crossings, a smaller grid, and a balanced mix of directions; a little seeded jitter breaks ties
          const across = this.placed.filter((p) => p.dir === 'across').length
          const balance = dir === 'across' ? (across <= this.placed.length / 2 ? 3 : 0) : across >= this.placed.length / 2 ? 3 : 0
          const score = x * 12 - (grownArea - this.area()) * 0.6 + balance + rng.next() * 2
          if (!best || score > best.score) best = { row, col, dir, crossings: x, score }
        })
      }
    }
    return best
  }

  layout(): Layout {
    return { placed: [...this.placed], crossings: this.crossings, minR: this.minR, maxR: this.maxR, minC: this.minC, maxC: this.maxC }
  }
}

function attempt(words: CrosswordWord[], rng: Rng, maxWords: number, maxW: number, maxH: number): Layout {
  // longest first, with jitter so attempts differ
  const order = words
    .map((w) => ({ w, k: w.letters.length + rng.next() * 3 }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.w)
  const board = new Board(maxW, maxH)
  const first = order.shift()!
  const firstDir: Dir = first.letters.length > maxW ? 'down' : 'across'
  board.place(first, 0, 0, firstDir, 0)
  // a few passes: a word that does not fit yet may cross a later one
  for (let pass = 0; pass < 3 && order.length && board.placed.length < maxWords; pass++) {
    for (let i = 0; i < order.length && board.placed.length < maxWords; ) {
      const spot = board.bestSpot(order[i]!, rng)
      if (spot) {
        board.place(order[i]!, spot.row, spot.col, spot.dir, spot.crossings)
        order.splice(i, 1)
      } else i++
    }
  }
  return board.layout()
}

const layoutScore = (l: Layout) => l.placed.length * 1000 + l.crossings * 25 - (l.maxR - l.minR + 1) * (l.maxC - l.minC + 1)

/**
 * Build a crossword from `words` (duplicates by id are ignored; words longer than the grid are skipped).
 * Returns an empty crossword when no word fits.
 */
export function generateCrossword(words: CrosswordWord[], seed: number, opts: CrosswordOptions = {}): Crossword {
  const maxWords = opts.maxWords ?? 9
  const maxW = opts.maxWidth ?? 11
  const maxH = opts.maxHeight ?? 11
  const attempts = opts.attempts ?? 24
  const seen = new Set<string>()
  const pool = words.filter((w) => {
    if (seen.has(w.id) || w.letters.length < 2 || w.letters.length > Math.max(maxW, maxH)) return false
    seen.add(w.id)
    return true
  })
  if (!pool.length) return { width: 0, height: 0, entries: [], grid: [] }
  const rng = new Rng(seed)
  let best: Layout | undefined
  for (let a = 0; a < attempts; a++) {
    const l = attempt(pool, rng, maxWords, maxW, maxH)
    if (!best || layoutScore(l) > layoutScore(best)) best = l
  }
  return finish(best!)
}

/** Shift to (0, 0), fill the grid and number the clues the usual way (row by row). */
function finish(l: Layout): Crossword {
  const height = l.maxR - l.minR + 1
  const width = l.maxC - l.minC + 1
  const grid: (string | null)[][] = Array.from({ length: height }, () => new Array<string | null>(width).fill(null))
  const placed = l.placed.map((p) => ({ ...p, row: p.row - l.minR, col: p.col - l.minC }))
  for (const p of placed) {
    for (const [[r, c], ch] of cellsOf({ ...p, letters: p.w.letters }).map((rc, i) => [rc, p.w.letters[i]!] as const)) grid[r]![c] = ch
  }
  const starts = new Map<string, number>()
  let n = 0
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (placed.some((p) => p.row === r && p.col === c)) starts.set(key(r, c), ++n)
    }
  }
  const entries: CrosswordEntry[] = placed
    .map((p) => ({ ...p.w, row: p.row, col: p.col, dir: p.dir, number: starts.get(key(p.row, p.col))! }))
    .sort((a, b) => a.number - b.number || (a.dir === b.dir ? 0 : a.dir === 'across' ? -1 : 1))
  return { width, height, entries, grid }
}
