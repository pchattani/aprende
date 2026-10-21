import { describe, it, expect } from 'vitest'
import { generateWordSearch, placementCells, occurrences, usableWords, snapLine, findSelection, inLine, WS_DIRS, ALL_DIRS, type WordSearch, type WsWord } from '@/engine/games/wordSearch'
import { newFetch, guess, isWon, isLost, shown, fetchPoints, fetchVerdict, fetchKeyboard, spared, FETCH_STEPS } from '@/engine/games/fetch'
import { isPlaced, scrambleOrder, newScramble, place, unplace, unplaceLast, placeLetter, hint, isSolved, isFull, clearSlots, reshuffle, scramblePoints, scrambleVerdict, pickDecoys, decoyCount, tileText } from '@/engine/games/scramble'
import { stripAccents as esStrip } from '@/lang/es/normalize'
import { stripAccents as frStrip } from '@/lang/fr/normalize'
import { stripAccents as ptStrip } from '@/lang/pt/normalize'
import { Rng } from '@/engine/random'

const esFold = (s: string) => esStrip(s.toLowerCase())
const frFold = (s: string) => frStrip(s.toLowerCase())
const W = (id: string, word: string, fold = esFold): WsWord => ({ id, letters: [...fold(word)] })
const ES = ['casa', 'perro', 'gato', 'mesa', 'agua', 'café', 'tren', 'playa', 'año', 'mano', 'noche', 'amigo'].map((w, i) => W(`w${i}`, w))
const FR = ['garçon', 'forêt', 'élève', 'château', 'cœur', 'noël', 'hôtel', 'pâte'].map((w, i) => W(`f${i}`, w.replace('œ', 'oe'), frFold))
// Cantonese answers are Jyutping without tones (see crosswordLetters)
const YUE = ['neihou', 'zousan', 'doze', 'mgoi', 'baaibaai', 'zoigin', 'gouhing', 'jingsik'].map((w, i) => ({ id: `y${i}`, letters: [...w] }))

/** Each word sits in the grid exactly once, inside the grid, on its own cells, in an allowed direction. */
function assertValid(ws: WordSearch, dirs = WS_DIRS.easy) {
  expect(ws.grid.length).toBe(ws.size)
  for (const row of ws.grid) {
    expect(row.length).toBe(ws.size)
    for (const ch of row) expect(ch).toMatch(/^\p{L}$/u)
  }
  const cellSets = new Set<string>()
  for (const p of ws.placements) {
    expect(dirs.some(([dr, dc]) => dr === p.dr && dc === p.dc)).toBe(true)
    const cells = placementCells(p)
    cells.forEach(([r, c], i) => {
      expect(r >= 0 && c >= 0 && r < ws.size && c < ws.size).toBe(true)
      expect(ws.grid[r]![c]).toBe(p.letters[i])
    })
    const key = cells.map(([r, c]) => `${r},${c}`).sort().join(' ')
    expect(cellSets.has(key)).toBe(false)
    cellSets.add(key)
    // no accidental second copy anywhere, in any direction
    expect(occurrences(ws.grid, p.letters)).toHaveLength(1)
  }
}

describe('word search', () => {
  it('places every word exactly once, deterministically for a seed', () => {
    const words = ES.slice(0, 8)
    const a = generateWordSearch(words, 42)
    expect(generateWordSearch(words, 42)).toEqual(a)
    expect(a.placements.map((p) => p.id).sort()).toEqual(words.map((w) => w.id).sort())
    assertValid(a)
    expect(a.size).toBeGreaterThanOrEqual(8)
    expect(a.size).toBeLessThanOrEqual(10)
  })
  it('holds for many seeds, levels and courses', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const level = (['easy', 'normal', 'hard'] as const)[seed % 3]!
      for (const set of [ES, FR, YUE]) {
        const words = new Rng(seed).sample(set, 8)
        const ws = generateWordSearch(words, seed, { dirs: WS_DIRS[level], alphabet: [...'abcdefghijklmnopqrstuvwxyz'] })
        expect(ws.placements.length).toBeGreaterThanOrEqual(6)
        assertValid(ws, WS_DIRS[level])
      }
    }
  })
  it('keeps letters only a course has (ñ) and folds accents away', () => {
    const ws = generateWordSearch([W('a', 'año'), W('b', 'café'), W('c', 'mañana'), W('d', 'canción')], 3)
    const letters = new Set(ws.grid.flat())
    expect(letters.has('ñ')).toBe(true)
    for (const ch of 'áéíóú') expect(letters.has(ch)).toBe(false)
    const fr = generateWordSearch(FR, 9)
    expect(new Set(fr.grid.flat()).has('ç')).toBe(false)
    assertValid(fr)
  })
  it('drops repeats and words hiding inside another', () => {
    const list = usableWords([W('a', 'sol'), W('b', 'soldado'), W('c', 'los'), W('d', 'sol'), W('e', 'mar'), W('f', 'rama'), W('g', 'abcdefghijk')])
    expect(list.map((w) => w.id)).toEqual(['a', 'e'])
  })
  it('backwards words only appear at the hard level', () => {
    const hard = Array.from({ length: 20 }, (_, s) => generateWordSearch(ES.slice(0, 8), s, { dirs: WS_DIRS.hard })).flatMap((w) => w.placements)
    expect(hard.some((p) => p.dc < 0 || (p.dr < 0 && p.dc === 0))).toBe(true)
    const easy = Array.from({ length: 20 }, (_, s) => generateWordSearch(ES.slice(0, 8), s)).flatMap((w) => w.placements)
    expect(easy.every((p) => p.dr >= 0 && p.dc >= 0)).toBe(true)
    expect(ALL_DIRS).toHaveLength(8)
  })
  it('snaps a swipe to a straight line and recognises a word from either end', () => {
    expect(snapLine([0, 0], [0, 3], 8)).toEqual([[0, 0], [0, 1], [0, 2], [0, 3]])
    expect(snapLine([0, 0], [3, 2], 8)).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]])
    expect(snapLine([2, 2], [2, 2], 8)).toEqual([[2, 2]])
    expect(snapLine([7, 0], [3, 1], 8)).toEqual([[7, 0], [6, 0], [5, 0], [4, 0], [3, 0]])
    // kept inside the grid
    expect(snapLine([6, 6], [9, 9], 8)).toEqual([[6, 6], [7, 7]])
    expect(inLine([0, 0], [3, 3])).toBe(true)
    expect(inLine([0, 0], [1, 3])).toBe(false)
    const ws = generateWordSearch(ES.slice(0, 6), 7)
    const p = ws.placements[0]!
    const cells = placementCells(p)
    expect(findSelection(ws.placements, cells)).toBe(p)
    expect(findSelection(ws.placements, [...cells].reverse())).toBe(p)
    expect(findSelection(ws.placements, cells.slice(0, -1))).toBeUndefined()
  })
})

describe('fetch', () => {
  it('reveals accented letters with their base letter and counts misses', () => {
    let s = newFetch('canción', esFold)
    s = guess(s, 'o')
    expect(shown(s)).toEqual([false, false, false, false, false, true, false])
    s = guess(s, 'x')
    s = guess(s, 'x') // a repeat costs nothing
    expect(s.misses).toBe(1)
    for (const k of 'canio') s = guess(s, k)
    expect(isWon(s)).toBe(true)
    expect(spared(s)).toBe(FETCH_STEPS - 1)
    expect(fetchPoints(s)).toBe(10 + 2 * (FETCH_STEPS - 1))
    expect(fetchVerdict(s)).toBe('correct')
    // ñ is its own letter in Spanish
    const n = guess(newFetch('año', esFold), 'n')
    expect(n.misses).toBe(1)
    expect(shown(guess(n, 'ñ'))).toEqual([false, true, false])
  })
  it('shows spaces and apostrophes, folds ç and ã', () => {
    const s = newFetch("l'été", frFold)
    expect(shown(s)).toEqual([false, true, false, false, false])
    expect(shown(guess(s, 'e'))).toEqual([false, true, true, false, true])
    expect(shown(guess(newFetch('garçon', frFold), 'c'))).toEqual([false, false, false, true, false, false])
    const pt = guess(newFetch('pão doce', (x) => ptStrip(x.toLowerCase())), 'a')
    expect(shown(pt)).toEqual([false, true, false, true, false, false, false, false])
  })
  it('loses after six misses and stops taking guesses', () => {
    let s = newFetch('gato', esFold)
    for (const k of 'bcdefh') s = guess(s, k)
    expect(isLost(s)).toBe(true)
    expect(fetchPoints(s)).toBe(0)
    expect(fetchVerdict(s)).toBe('wrong')
    expect(guess(s, 'g')).toBe(s)
  })
  it('has a key for ñ in Spanish only', () => {
    expect(fetchKeyboard(esFold).flat()).toContain('ñ')
    expect(fetchKeyboard(frFold).flat()).not.toContain('ñ')
    expect(fetchKeyboard(frFold).flat()).toHaveLength(26)
  })
})

describe('scramble', () => {
  it('never returns the word in order, even with repeated letters', () => {
    for (const w of ['casa', 'ab', 'perro', 'aab', 'ñandú', '你好', '對唔住']) {
      const tiles = [...w]
      for (let seed = 0; seed < 200; seed++) {
        const order = scrambleOrder(tiles, new Rng(seed))!
        expect([...order].sort((a, b) => a - b)).toEqual(tiles.map((_, i) => i))
        expect(order.map((i) => tiles[i]).join('')).not.toBe(w)
      }
    }
    expect(scrambleOrder([...'拜拜'], new Rng(1))).toBeUndefined()
    expect(scrambleOrder(['a'], new Rng(1))).toBeUndefined()
  })
  it('places, returns and checks tiles; identical letters are interchangeable', () => {
    let s = newScramble([...'casa'], new Rng(3))!
    const tileOf = (ch: string, nth = 0) => s.tiles.map((t, i) => [t, i] as const).filter(([t]) => t === ch)[nth]![1]
    s = place(s, tileOf('c'))
    s = place(s, tileOf('a', 1)) // the "other" a
    s = place(s, tileOf('s'))
    expect(isFull(s)).toBe(false)
    s = unplace(s, 2)
    expect(s.slots).toEqual([tileOf('c'), tileOf('a', 1), null, null])
    s = placeLetter(s, 's')
    s = placeLetter(s, 'a')
    expect(isSolved(s)).toBe(true)
    expect(scrambleVerdict(s)).toBe('correct')
    // a wrong fill clears back to the pool
    let t = newScramble([...'gato'], new Rng(4))!
    for (const ch of 'otag') t = placeLetter(t, ch)
    expect(isFull(t) && !isSolved(t)).toBe(true)
    t = clearSlots(t, true)
    expect(t.slots.every((x) => x === null)).toBe(true)
    expect(t.misses).toBe(1)
    expect(reshuffle(t, new Rng(1)).pool.slice().sort()).toEqual(t.pool.slice().sort())
  })
  it('hints reveal the next letter, lock it and cost points', () => {
    let s = newScramble([...'perro'], new Rng(5))!
    s = placeLetter(s, 'r') // wrong letter in the first slot
    s = hint(s)
    expect(s.tiles[s.slots[0]!]).toBe('p')
    expect(s.locked[0]).toBe(true)
    expect(s.hints).toBe(1)
    // the r went back to the pool; a locked slot cannot be emptied
    expect(s.slots.filter((x) => x !== null)).toHaveLength(1)
    expect(unplace(s, 0)).toBe(s)
    s = placeLetter(s, 'e')
    s = hint(s) // e was already right: the hint locks it and reveals the r
    expect(s.slots.slice(0, 3).map((t) => s.tiles[t!])).toEqual(['p', 'e', 'r'])
    expect(s.locked.slice(0, 3)).toEqual([true, true, true])
    expect(unplaceLast(s)).toBe(s)
    for (const ch of 'ro') s = placeLetter(s, ch)
    expect(isSolved(s)).toBe(true)
    expect(scrambleVerdict(s)).toBe('almost')
    expect(scrambleVerdict(s, true)).toBe('wrong')
    expect(scramblePoints(5, 0, 0)).toBe(20)
    expect(scramblePoints(5, 2, 0)).toBe(10)
    expect(scramblePoints(5, 0, 3)).toBe(40)
    expect(scramblePoints(2, 9, 0)).toBe(2)
  })
  it('adds decoys to short Cantonese words: never from the answer, never spelling a synonym', () => {
    expect([decoyCount(2), decoyCount(3), decoyCount(4)]).toEqual([2, 1, 0])
    const others = [...'爸媽口出入門大學生']
    for (let seed = 0; seed < 100; seed++) {
      for (const word of ['入口', '大學生', '爸爸']) {
        const answer = [...word]
        const decoys = pickDecoys(answer, others, decoyCount(answer.length), new Rng(seed))
        expect(decoys).toHaveLength(decoyCount(answer.length))
        expect(new Set(decoys).size).toBe(decoys.length)
        for (const d of decoys) expect(answer).not.toContain(d)
        const s = newScramble(answer, new Rng(seed), decoys)
        if (!s) continue // 爸爸 cannot be scrambled
        expect([...s.pool].sort((a, b) => a - b)).toEqual([...answer, ...decoys].map((_, i) => i))
        // the answer tiles never read in order in the tray
        expect(s.pool.filter((t) => t < answer.length).map((t) => tileText(s, t)).join('')).not.toBe(word)
        // a decoy is just a wrong order; the answer still spells correctly with decoys left over
        let wrong = s
        for (const t of s.pool.slice(0, answer.length)) wrong = place(wrong, t)
        expect(isFull(wrong) && isSolved(wrong)).toBe(false)
        let right = s
        for (const ch of answer) right = placeLetter(right, ch)
        expect(isSolved(right)).toBe(true)
        expect(right.pool.filter((t) => !isPlaced(right, t)).map((t) => tileText(right, t)).sort()).toEqual([...decoys].sort())
        // hints never reach for a decoy
        let hinted = s
        for (let i = 0; i < answer.length; i++) hinted = hint(hinted)
        expect(isSolved(hinted)).toBe(true)
      }
    }
    // 出口 ("exit") is fine as a distractor, but 門口 also means "entrance": 門 is never offered
    const synonyms = new Set(['門口'])
    for (let seed = 0; seed < 50; seed++) expect(pickDecoys([...'入口'], [...'門出山'], 2, new Rng(seed), (w) => synonyms.has(w))).not.toContain('門')
    // not enough characters: fewer decoys
    expect(pickDecoys([...'入口'], [...'入口出'], 2, new Rng(1))).toEqual(['出'])
  })
})
