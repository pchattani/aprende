import { describe, it, expect } from 'vitest'
import { generateCrossword, cellsOf, type Crossword, type CrosswordWord } from '@/engine/crossword'
import { crosswordLetters, crosswordLookup, pickGameWords } from '@/engine/vocabGame'
import { vocab } from '@/engine/loader'
import { languagePack } from '@lang'
import { Rng } from '@/engine/random'
import type { CardRow } from '@/engine/types'

const W = (id: string, word: string): CrosswordWord => ({ id, letters: [...word], clue: `clue ${id}` })
const WORDS = ['casa', 'perro', 'gato', 'mesa', 'agua', 'café', 'tren', 'playa', 'noche', 'amigo', 'libro', 'ciudad', 'año', 'sol', 'mano', 'tarde'].map((w, i) => W(`w${i}`, w))

/** Every cell holds one letter, the words in the grid are exactly the entries, and everything is connected. */
function assertValid(cw: Crossword) {
  const at = new Map<string, string>()
  for (const e of cw.entries) {
    cellsOf(e).forEach(([r, c], i) => {
      expect(r).toBeGreaterThanOrEqual(0)
      expect(c).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(cw.height)
      expect(c).toBeLessThan(cw.width)
      const k = `${r},${c}`
      const prev = at.get(k)
      if (prev !== undefined) expect(prev).toBe(e.letters[i]) // no conflicting letters
      at.set(k, e.letters[i]!)
      expect(cw.grid[r]![c]).toBe(e.letters[i])
    })
  }
  // no stray letters in the grid
  let filled = 0
  cw.grid.forEach((row, r) => row.forEach((ch, c) => ch !== null && (filled++, expect(at.has(`${r},${c}`)).toBe(true))))
  expect(filled).toBe(at.size)
  // every run of 2+ letters in a row or column is an entry (no accidental words from side-by-side placement)
  const runs: string[] = []
  for (const dir of ['across', 'down'] as const) {
    const [outer, inner] = dir === 'across' ? [cw.height, cw.width] : [cw.width, cw.height]
    for (let o = 0; o < outer; o++) {
      let start = -1
      for (let i = 0; i <= inner; i++) {
        const ch = i < inner ? (dir === 'across' ? cw.grid[o]![i] : cw.grid[i]![o]) : null
        if (ch !== null && start < 0) start = i
        if (ch === null && start >= 0) {
          if (i - start >= 2) runs.push(dir === 'across' ? `${dir}:${o},${start}` : `${dir}:${start},${o}`)
          start = -1
        }
      }
    }
  }
  expect(runs.sort()).toEqual(cw.entries.map((e) => `${e.dir}:${e.row},${e.col}`).sort())
  // connected: walk from the first word through shared cells
  const owners = new Map<string, number[]>()
  cw.entries.forEach((e, i) => cellsOf(e).forEach(([r, c]) => owners.set(`${r},${c}`, [...(owners.get(`${r},${c}`) ?? []), i])))
  const seen = new Set([0])
  const queue = [0]
  while (queue.length) {
    const i = queue.shift()!
    for (const [r, c] of cellsOf(cw.entries[i]!)) {
      for (const j of owners.get(`${r},${c}`)!) {
        if (!seen.has(j)) {
          seen.add(j)
          queue.push(j)
        }
      }
    }
  }
  expect(seen.size).toBe(cw.entries.length)
}

describe('crossword generator', () => {
  it('places 6–9 words on a connected grid without conflicting letters', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const cw = generateCrossword(WORDS, seed)
      expect(cw.entries.length).toBeGreaterThanOrEqual(6)
      expect(cw.entries.length).toBeLessThanOrEqual(9)
      expect(cw.width).toBeLessThanOrEqual(11)
      expect(cw.height).toBeLessThanOrEqual(11)
      assertValid(cw)
    }
  })
  it('is deterministic: the same seed gives the same grid', () => {
    expect(generateCrossword(WORDS, 42)).toEqual(generateCrossword(WORDS, 42))
    const grids = new Set(Array.from({ length: 8 }, (_, s) => JSON.stringify(generateCrossword(WORDS, s + 1).grid)))
    expect(grids.size).toBeGreaterThan(1)
  })
  it('numbers clues row by row and shares a number when across and down start together', () => {
    const cw = generateCrossword(WORDS, 7)
    const numbers = [...new Set(cw.entries.map((e) => e.number))]
    expect(numbers).toEqual(numbers.map((_, i) => i + 1))
    for (const a of cw.entries) for (const b of cw.entries) if (a.row === b.row && a.col === b.col) expect(a.number).toBe(b.number)
    const firsts = [...new Map(cw.entries.map((e) => [e.number, e])).values()]
    for (let i = 1; i < firsts.length; i++) {
      const p = firsts[i - 1]!
      const q = firsts[i]!
      expect(p.row < q.row || (p.row === q.row && p.col < q.col)).toBe(true)
    }
  })
  it('respects a smaller grid and skips words that cannot fit', () => {
    const cw = generateCrossword([...WORDS, W('long', 'extraordinariamente')], 3, { maxWidth: 8, maxHeight: 8, maxWords: 6 })
    expect(cw.entries.length).toBeLessThanOrEqual(6)
    expect(cw.width).toBeLessThanOrEqual(8)
    expect(cw.height).toBeLessThanOrEqual(8)
    expect(cw.entries.some((e) => e.id === 'long')).toBe(false)
    assertValid(cw)
  })
  it('handles degenerate input', () => {
    expect(generateCrossword([], 1).entries).toEqual([])
    const one = generateCrossword([W('a', 'casa')], 1)
    expect(one.entries.length).toBe(1)
    expect(one.width * one.height).toBe(4)
    // words with no letters in common cannot cross: only one is placed
    const two = generateCrossword([W('a', 'sol'), W('b', 'paz')], 1)
    expect(two.entries.length).toBe(1)
  })
})

describe('crossword words from the course', () => {
  it('builds a crossword from the first words of this course', () => {
    const lookup = crosswordLookup((id) => vocab.get(id), languagePack)
    const ids = [...vocab.values()].filter((v) => v.level === 'a1').slice(0, 120).map((v) => v.id)
    const cards = ids.map((id, i): CardRow => ({ id, kind: 'word', level: 'a1', lessonId: 'a1.u01.l1', grammar: [], stage: 0, streak: 0, due: i, stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps: 1, lapses: 0, state: 2 }))
    const picked = pickGameWords(cards, lookup, 16, new Rng(9), 1_000_000)
    expect(picked.length).toBe(16)
    const cw = generateCrossword(
      picked.map((v) => ({ id: v.id, letters: crosswordLetters(v, languagePack.normalize)!, clue: v.en[0]! })),
      11,
    )
    expect(cw.entries.length).toBeGreaterThanOrEqual(5)
    assertValid(cw)
    for (const e of cw.entries) {
      // letters only: no spaces, apostrophes, hyphens or tone numbers
      expect(e.letters.every((ch) => /^\p{L}$/u.test(ch))).toBe(true)
      expect(e.letters.join('')).toBe(e.letters.join('').toLowerCase())
    }
  })
  it('skips multi-word lemmas, keeps accents and strips Jyutping tones', () => {
    const V = (lemma: string, extra = {}) => ({ id: 'w.x', lemma, pos: 'noun', en: ['x'], level: 'a1', tags: [], ...extra }) as never
    const norm = (s: string) => s.toLowerCase()
    expect(crosswordLetters(V('buenos días'), norm)).toBeUndefined()
    expect(crosswordLetters(V('el'), norm)).toBeUndefined()
    expect(crosswordLetters(V("l'eau"), norm)).toBeUndefined()
    expect(crosswordLetters(V('Café'), norm)).toEqual(['c', 'a', 'f', 'é'])
    expect(crosswordLetters(V('你好', { jp: 'nei5 hou2' }), norm)).toEqual([...'neihou'])
    expect(crosswordLetters(V('唔', { jp: 'm4' }), norm)).toBeUndefined()
  })
  it('drops clues that give the answer away', () => {
    const v = { id: 'w.hotel', lemma: 'hotel', pos: 'noun', en: ['hotel'], level: 'a1', tags: [] } as never
    const w = { id: 'w.casa', lemma: 'casa', pos: 'noun', en: ['house'], level: 'a1', tags: [] } as never
    const m = new Map([['w.hotel', v], ['w.casa', w]])
    const lookup = crosswordLookup((id) => m.get(id), { normalize: (s) => s.toLowerCase(), stripMarks: (s) => s })
    expect(lookup('w.hotel')).toBeUndefined()
    expect(lookup('w.casa')).toBe(w)
  })
})
