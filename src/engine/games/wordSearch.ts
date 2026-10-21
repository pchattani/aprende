/**
 * Word search: hide words in a square grid of letters, across, down and diagonally (and backwards
 * at higher levels), then fill the gaps with other letters. Seeded and deterministic. Every word in
 * the result is placed exactly once: no word is a part of another, and no filler letters spell a
 * second copy of a word in any of the eight directions.
 */
import { Rng } from '../random'

/** A step between neighbouring cells: [rows, columns]. */
export type WsDir = readonly [number, number]
export type WsLevel = 'easy' | 'normal' | 'hard'

const ACROSS: WsDir = [0, 1]
const DOWN: WsDir = [1, 0]
const DIAG_DOWN: WsDir = [1, 1]
const DIAG_UP: WsDir = [-1, 1]
/** All eight directions (what a reader can swipe). */
export const ALL_DIRS: readonly WsDir[] = [ACROSS, DOWN, DIAG_DOWN, DIAG_UP, [0, -1], [-1, 0], [-1, -1], [1, -1]]
/** Where words may run, by level: easy reads left to right and top to bottom; hard runs every way. */
export const WS_DIRS: Record<WsLevel, readonly WsDir[]> = {
  easy: [ACROSS, DOWN, DIAG_DOWN],
  normal: [ACROSS, DOWN, DIAG_DOWN, DIAG_UP],
  hard: ALL_DIRS,
}

export interface WsWord {
  id: string
  /** The letters as they appear in the grid (already folded: no accents, lowercase). */
  letters: string[]
}
export interface WsPlacement extends WsWord {
  row: number
  col: number
  dr: number
  dc: number
}
export interface WordSearch {
  size: number
  /** size × size letters. */
  grid: string[][]
  /** In the order of the input words (the ones that made it into the grid). */
  placements: WsPlacement[]
}
export interface WsOptions {
  dirs?: readonly WsDir[]
  /** Smallest and largest grid (default 8 and 10). */
  minSize?: number
  maxSize?: number
  /** Letters for the gaps, besides the words' own letters (the alphabet of the course). */
  alphabet?: readonly string[]
}

export type Cell = [number, number]
export const cellKey = (r: number, c: number) => `${r},${c}`

export function placementCells(p: Pick<WsPlacement, 'row' | 'col' | 'dr' | 'dc' | 'letters'>): Cell[] {
  return p.letters.map((_, i) => [p.row + i * p.dr, p.col + i * p.dc])
}

const joined = (w: WsWord) => w.letters.join('')
const reversed = (w: WsWord) => [...w.letters].reverse().join('')

/**
 * The words worth hiding, in their given order: no repeats, nothing longer than the grid, and no
 * word that sits inside another (sol in soldado, or backwards) since it would be found twice.
 */
export function usableWords(words: WsWord[], maxSize = 10): WsWord[] {
  const out: WsWord[] = []
  for (const w of words) {
    if (w.letters.length < 2 || w.letters.length > maxSize) continue
    const s = joined(w)
    const r = reversed(w)
    if (out.some((o) => joined(o).includes(s) || joined(o).includes(r) || s.includes(joined(o)) || s.includes(reversed(o)))) continue
    out.push(w)
  }
  return out
}

/** Every start cell of `letters` in the grid, in any of the eight directions, as distinct cell sets. */
export function occurrences(grid: (string | null)[][], letters: readonly string[]): Cell[][] {
  const n = grid.length
  const seen = new Set<string>()
  const out: Cell[][] = []
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (grid[r]![c] !== letters[0]) continue
      for (const [dr, dc] of ALL_DIRS) {
        const cells: Cell[] = []
        let ok = true
        for (let i = 0; i < letters.length; i++) {
          const rr = r + i * dr
          const cc = c + i * dc
          if (rr < 0 || cc < 0 || rr >= n || cc >= n || grid[rr]![cc] !== letters[i]) {
            ok = false
            break
          }
          cells.push([rr, cc])
        }
        if (!ok) continue
        const key = cells.map(([a, b]) => cellKey(a, b)).sort().join(' ')
        if (seen.has(key)) continue
        seen.add(key)
        out.push(cells)
      }
    }
  return out
}

/** Try to lay every word (longest first) into an empty grid; undefined when one does not fit. */
function layOut(words: WsWord[], size: number, dirs: readonly WsDir[], rng: Rng): { grid: (string | null)[][]; placements: WsPlacement[] } | undefined {
  const grid: (string | null)[][] = Array.from({ length: size }, () => new Array<string | null>(size).fill(null))
  const order = rng.shuffle(words.map((_, i) => i)).sort((a, b) => words[b]!.letters.length - words[a]!.letters.length)
  const placed: (WsPlacement | undefined)[] = new Array(words.length)
  for (const wi of order) {
    const w = words[wi]!
    const L = w.letters.length
    const spots: { p: WsPlacement; cross: number }[] = []
    for (const [dr, dc] of dirs)
      for (let row = 0; row < size; row++)
        for (let col = 0; col < size; col++) {
          const er = row + (L - 1) * dr
          const ec = col + (L - 1) * dc
          if (er < 0 || ec < 0 || er >= size || ec >= size) continue
          let cross = 0
          let ok = true
          for (let i = 0; i < L; i++) {
            const have = grid[row + i * dr]![col + i * dc]
            if (have === null) continue
            if (have !== w.letters[i]) {
              ok = false
              break
            }
            cross++
          }
          // a word may share letters with another, but never lie wholly on top of it
          if (ok && cross < L) spots.push({ p: { ...w, row, col, dr, dc }, cross })
        }
    if (!spots.length) return undefined
    // spread the directions evenly, with a mild preference for crossings (a denser, trickier grid)
    const byDir = new Map<string, typeof spots>()
    for (const s of spots) byDir.set(`${s.p.dr},${s.p.dc}`, [...(byDir.get(`${s.p.dr},${s.p.dc}`) ?? []), s])
    const pool = rng.pick([...byDir.values()])
    const crossing = pool.filter((s) => s.cross > 0)
    const spot = crossing.length && rng.next() < 0.5 ? rng.pick(crossing) : rng.pick(pool)
    placementCells(spot.p).forEach(([r, c], i) => (grid[r]![c] = w.letters[i]!))
    placed[wi] = spot.p
  }
  return { grid, placements: placed as WsPlacement[] }
}

/**
 * Fill the gaps, then re-roll filler letters until every word occurs exactly once.
 * Undefined when a stray copy is made only of word letters (then the layout is rejected).
 */
function fill(laid: { grid: (string | null)[][]; placements: WsPlacement[] }, pool: readonly string[], rng: Rng): string[][] | undefined {
  const grid = laid.grid.map((row) => [...row])
  const free = new Set<string>()
  grid.forEach((row, r) => row.forEach((ch, c) => ch === null && (free.add(cellKey(r, c)), (grid[r]![c] = rng.pick(pool)))))
  for (let pass = 0; pass < 400; pass++) {
    let clean = true
    for (const p of laid.placements) {
      const own = placementCells(p).map(([r, c]) => cellKey(r, c)).sort().join(' ')
      for (const cells of occurrences(grid, p.letters)) {
        if (cells.map(([r, c]) => cellKey(r, c)).sort().join(' ') === own) continue
        clean = false
        const loose = cells.filter(([r, c]) => free.has(cellKey(r, c)))
        if (!loose.length) return undefined
        const [r, c] = rng.pick(loose)
        grid[r]![c] = rng.pick(pool)
      }
    }
    if (clean) return grid as string[][]
  }
  return undefined
}

/**
 * Build a word search from `words` (most wanted first). The grid grows from `minSize` to
 * `maxSize` until every word fits; if they still do not, the last words are dropped one by one.
 */
export function generateWordSearch(words: WsWord[], seed: number, opts: WsOptions = {}): WordSearch {
  const dirs = opts.dirs ?? WS_DIRS.easy
  const maxSize = opts.maxSize ?? 10
  const rng = new Rng(seed)
  let list = usableWords(words, maxSize)
  // filler letters: the words' own letters (so the grid looks like the language) plus the alphabet
  const pool = [...list.flatMap((w) => w.letters), ...(opts.alphabet ?? [])]
  if (!pool.length) pool.push('a')
  while (list.length) {
    const longest = Math.max(...list.map((w) => w.letters.length))
    const total = list.reduce((n, w) => n + w.letters.length, 0)
    const from = Math.min(maxSize, Math.max(opts.minSize ?? 8, longest, Math.ceil(Math.sqrt(total * 1.6))))
    for (let size = from; size <= maxSize; size++)
      for (let attempt = 0; attempt < 30; attempt++) {
        const laid = layOut(list, size, dirs, rng)
        if (!laid) continue
        const grid = fill(laid, pool, rng)
        if (grid) return { size, grid, placements: laid.placements }
      }
    list = list.slice(0, -1)
  }
  const size = opts.minSize ?? 8
  return { size, grid: Array.from({ length: size }, () => Array.from({ length: size }, () => rng.pick(pool))), placements: [] }
}

/**
 * The straight line a swipe from `start` towards `to` selects: snapped to the nearest of the
 * eight directions and kept inside the grid.
 */
export function snapLine(start: Cell, to: Cell, size: number): Cell[] {
  const dr = to[0] - start[0]
  const dc = to[1] - start[1]
  if (!dr && !dc) return [start]
  const step = Math.round(Math.atan2(dr, dc) / (Math.PI / 4))
  const sr = Math.round(Math.sin((step * Math.PI) / 4))
  const sc = Math.round(Math.cos((step * Math.PI) / 4))
  let len = sr && sc ? Math.round((Math.abs(dr) + Math.abs(dc)) / 2) : Math.max(Math.abs(dr), Math.abs(dc))
  const inside = (k: number) => {
    const r = start[0] + k * sr
    const c = start[1] + k * sc
    return r >= 0 && c >= 0 && r < size && c < size
  }
  while (len > 0 && !inside(len)) len--
  return Array.from({ length: len + 1 }, (_, k) => [start[0] + k * sr, start[1] + k * sc] as Cell)
}

/** True when two cells lie on one straight line (across, down or diagonal). */
export const inLine = (a: Cell, b: Cell) => a[0] === b[0] || a[1] === b[1] || Math.abs(a[0] - b[0]) === Math.abs(a[1] - b[1])

/** The placement a selection covers, read from either end; undefined when it is not a hidden word. */
export function findSelection<P extends Pick<WsPlacement, 'row' | 'col' | 'dr' | 'dc' | 'letters'>>(placements: readonly P[], cells: readonly Cell[]): P | undefined {
  if (cells.length < 2) return undefined
  const key = (cs: readonly Cell[]) => cs.map(([r, c]) => cellKey(r, c)).join(' ')
  const fwd = key(cells)
  const back = key([...cells].reverse())
  return placements.find((p) => {
    const k = key(placementCells(p))
    return k === fwd || k === back
  })
}
